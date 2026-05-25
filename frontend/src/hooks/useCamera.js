// frontend/src/hooks/useCamera.js
// Manages TWO cameras simultaneously.
// Exposes a captureFrame() that returns raw frames and
// captureStitched(calib) that returns a single calibrated JPEG.

import { useRef, useState, useCallback, useEffect } from "react";
import { buildStitch, canvasToDataURL } from "../utils/stitch";


export function useCamera() {
  const video0Ref   = useRef(null);   // first camera
  const video1Ref   = useRef(null);   // second camera
  const stream0Ref  = useRef(null);
  const stream1Ref  = useRef(null);

  const [ready,       setReady]       = useState(false);
  const [error,       setError]       = useState(null);
  const [deviceIds,   setDeviceIds]   = useState([]);   // available video device IDs
  const [cam0Id,      setCam0Id]      = useState(null); // selected device for cam 0
  const [cam1Id,      setCam1Id]      = useState(null); // selected device for cam 1
  const [locked,      setLocked]      = useState(false); // camera settings locked

  // ── Enumerate cameras ──────────────────────────────────────────────────────
  const enumerateCameras = useCallback(async () => {
    try {
      // Must request permission first before deviceId labels are available
      const temp = await navigator.mediaDevices.getUserMedia({ video: true });
      temp.getTracks().forEach(t => t.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(d => d.kind === "videoinput");
      console.log("[Camera] Found cameras:", cameras.map(c => `${c.label} (${c.deviceId})`));
      setDeviceIds(cameras);

      // Auto-select first two cameras
      if (cameras.length >= 1) setCam0Id(cameras[0].deviceId);
      if (cameras.length >= 2) {
        
        const cam1 = cameras.find((c, i) => i > 0 && c.deviceId !== cameras[0].deviceId)
                  || cameras[1]; 
        setCam1Id(cam1.deviceId);
      }
    } catch (err) {
      setError(`Camera enumeration failed: ${err.message}`);
    }
  }, []);

  // ── Open one stream by deviceId ────────────────────────────────────────────
const openStream = useCallback(async (deviceId) => {
  const constraints = {
    video: {
      deviceId: { exact: deviceId },
      width: { ideal: 960 },
      height: { ideal: 1080 },
    },
  };
  
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  const track = stream.getVideoTracks()[0];
  
  const capabilities = track.getCapabilities();
  

  if (capabilities.exposureMode?.includes('continuous')) {
    await track.applyConstraints({
      advanced: [{ exposureMode: 'continuous' }]
    });
  }

  return stream;
}, []);

  const startCameras = useCallback(async () => {
      if (!cam0Id) return;
      try {
        stream0Ref.current?.getTracks().forEach(t => t.stop());
        stream1Ref.current?.getTracks().forEach(t => t.stop());

        // Helper: attach stream to video element and wait until it has
        // real non-zero dimensions — this is the key fix.
        const attachAndWait = (videoEl, stream) => new Promise((resolve, reject) => {
          if (!videoEl || !stream) { resolve(); return; }
          videoEl.srcObject = stream;

          const onReady = async () => {
            try {
              await videoEl.play();

              // Poll until videoWidth/videoHeight are non-zero
              let attempts = 0;
              while ((videoEl.videoWidth === 0 || videoEl.videoHeight === 0)
                    && attempts < 50) {
                await new Promise(r => setTimeout(r, 100));
                attempts++;
              }

              console.log(
                `[Camera] Ready — ${videoEl.videoWidth}×${videoEl.videoHeight}`
              );
              resolve();
            } catch (err) { reject(err); }
          };

          if (videoEl.readyState >= 2) {
            onReady();
          } else {
            videoEl.onloadedmetadata = onReady;
          }
        });

        // --- THE FIX: SEQUENTIAL LOADING ---
        
        // 1. Ask computer for Camera 0
        const stream0 = await openStream(cam1Id);
        stream0Ref.current = stream0;
        
       
        await attachAndWait(video0Ref.current, stream0);

        
        if (cam0Id) {
         
          await new Promise(resolve => setTimeout(resolve, 1000));
        
          const stream1 = await openStream(cam0Id);
          stream1Ref.current = stream1;
          
      
          await attachAndWait(video1Ref.current, stream1);
        }

        setReady(true);
        setError(null);
      } catch (err) {
        setError(`Camera start failed: ${err.message}`);
      }
    }, [cam0Id, cam1Id, openStream]);

  // ── Lock camera settings ──────────────────────────────────────────────────
  // Freezes each camera at its current exposure, white balance, and focus so
  // removing the medicine boxes from the scene doesn't trigger re-adjustment.
  //
  // Exposure / white balance: switch to 'manual' WITHOUT a target value.
  //   The camera holds whatever the auto algorithm settled on.  Specifying an
  //   explicit exposureTime caused a white-screen on the other camera because
  //   different USB firmware use different internal unit scales.
  //
  // Focus: switch to 'manual' AND supply the current focusDistance from the
  //   same track.  Without a value the browser enters "manual" mode but some
  //   cameras still hunt when the scene changes drastically (medicine removed).
  //   Reading from the same track is safe — no cross-camera unit mismatch.
  //
  // We wait 2 s first so auto-exposure has fully settled on the medicine boxes.
  const lockCameras = useCallback(async () => {
    // Wait for auto-exposure to fully settle on the current scene before locking.
    console.log(`[Camera] Waiting for exposure to settle...`);
    await new Promise(r => setTimeout(r, 2000));

    const streams = [stream0Ref.current, stream1Ref.current].filter(Boolean);

    for (const stream of streams) {
      const track = stream.getVideoTracks()[0];
      if (!track) continue;

      const capabilities = track.getCapabilities();
      const settings     = track.getSettings();   // read current values from THIS track
      const advanced     = [];

      
      if (capabilities.exposureMode?.includes('manual'))
        advanced.push({ exposureMode: 'manual'});

      // White balance: same reasoning — mode-only is safe.
      if (capabilities.whiteBalanceMode?.includes('manual'))
        advanced.push({ whiteBalanceMode: 'manual' });

      // Lock focus with the current focal distance.
      if (capabilities.focusMode?.includes('manual')) {
        const entry = { focusMode: 'manual' };
        if (settings.focusDistance !== undefined) entry.focusDistance = settings.focusDistance;
        advanced.push(entry);
      }

      // Lock gain if the camera exposes it (prevents auto-gain compensating after
      // exposure is pinned, which can still cause brightness shifts on some drivers).
      if (capabilities.gain !== undefined && settings.gain !== undefined) {
        advanced.push({ gain: settings.gain });
      }

      // Lock brightness if exposed as a controllable property.
      if (capabilities.brightness !== undefined && settings.brightness !== undefined) {
        advanced.push({ brightness: settings.brightness });
      }

      if (advanced.length > 0) {
        try {
          await track.applyConstraints({ advanced });
          const s = track.getSettings();
          console.log(
            `[Camera] Locked — exposure: ${s.exposureTime}, wb: ${s.colorTemperature}K, ` +
            `focus: ${s.focusDistance}, gain: ${s.gain}, brightness: ${s.brightness}`
          );
        } catch (err) {
          console.warn(`[Camera] Lock failed:`, err.message);
        }
      }
    }

    setLocked(true);
    console.log(`[Camera] All settings locked`);
  }, []);

  // ── Unlock camera settings — restore auto modes ────────────────────────────
  const unlockCameras = useCallback(async () => {
    const streams = [stream0Ref.current, stream1Ref.current].filter(Boolean);

    for (const stream of streams) {
      const track = stream.getVideoTracks()[0];
      if (!track) continue;

      const capabilities = track.getCapabilities();
      const advanced     = [];

      if (capabilities.exposureMode?.includes('continuous')) {
        advanced.push({ exposureMode: 'continuous' });
      }
      if (capabilities.whiteBalanceMode?.includes('continuous')) {
        advanced.push({ whiteBalanceMode: 'continuous' });
      }
      if (capabilities.focusMode?.includes('continuous')) {
        advanced.push({ focusMode: 'continuous' });
      }

      if (advanced.length > 0) {
        try {
          await track.applyConstraints({ advanced });
        } catch (err) {
          console.warn(`[Camera] Unlock failed:`, err.message);
        }
      }
    }

    setLocked(false);
    console.log(`[Camera] Settings unlocked — auto modes restored`);
  }, []);

  const stopCameras = useCallback(() => {
    stream0Ref.current?.getTracks().forEach(t => t.stop());
    stream1Ref.current?.getTracks().forEach(t => t.stop());
    stream0Ref.current = null;
    stream1Ref.current = null;
    setReady(false);
  }, []);


  // ── captureStitched — rotate + crop + offset + stitch → single JPEG ──────────
  const captureStitched = useCallback((calib, correction = null) => {
    const v0 = video0Ref.current;
    const v1 = video1Ref.current;
    if (!v0 || !ready) return null;
    const stitched = buildStitch(v0, v1, calib ?? {}, {}, correction);
    if (!stitched) return null;
    return canvasToDataURL(stitched, 0.92);
  }, [ready]);

  // ── Capture — return an array of individual frames ─────────────
  const captureFrame = useCallback(() => {
    const v0 = video0Ref.current;
    const v1 = video1Ref.current;

    const w0 = v0.videoWidth;
    const h0 = v0.videoHeight;
    const hasCam1Stream = v1 && v1.srcObject && v1.videoWidth > 0 && v1.videoHeight > 0;
    const w1 = hasCam1Stream ? v1.videoWidth  : 0;
    const h1 = hasCam1Stream ? v1.videoHeight : 0;

  
    console.log(`Left Cam (Blurry/Wide) Resolution: ${w0}x${h0}`);
    console.log(`Right Cam (Sharp/Zoomed) Resolution: ${w1}x${h1}`);

    if (!v0 || !ready) return null;

    const frames = [];

   
    const captureSingleVideo = (videoElement) => {
      if (!videoElement || !videoElement.srcObject || videoElement.videoWidth === 0) return null;
      
      const w = videoElement.videoWidth;
      const h = videoElement.videoHeight;
      
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      
      const ctx = canvas.getContext("2d");
      ctx.drawImage(videoElement, 0, 0, w, h);
      
      return canvas.toDataURL("image/png");
    };

    const frame0 = captureSingleVideo(v0);
    if (frame0) frames.push(frame0);

    
    const frame1 = captureSingleVideo(v1);
    if (frame1) frames.push(frame1);

   
    return frames.length > 0 ? frames : null;
  }, [ready]);

  // ── Init: enumerate then start ─────────────────────────────────────────────
  useEffect(() => {
    enumerateCameras();
    return () => stopCameras();
  }, []);   // eslint-disable-line

  // Re-start when selected devices change
  useEffect(() => {
    if (cam0Id) startCameras();
  }, [cam0Id, cam1Id]);   // eslint-disable-line

  return {
    video0Ref, video1Ref,
    ready, error,
    captureFrame, captureStitched,
    deviceIds, cam0Id, setCam0Id, cam1Id, setCam1Id,
    locked, lockCameras, unlockCameras,
  };
}