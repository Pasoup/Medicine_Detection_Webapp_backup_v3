import serial
import time

_ser = None
_connected = False


def connect(port="COM7", baud=9600):
    global _ser, _connected
    try:
        _ser = serial.Serial(port, baud, timeout=1)
        time.sleep(2)
        led_white()
        _connected = True
        print(f"[LED] Connected on {port}")
    except Exception as e:
        _ser = None
        _connected = False
        print(f"[LED] WARNING: Could not connect to {port} — {e}")


def is_connected() -> bool:
    return _connected


def send(cmd: str):
    if _ser and _ser.is_open:
        _ser.write(cmd.encode())


def led_white():    send('1')
def led_off():      send('0')
def led_green():    send('G')
def led_red():      send('R')
def led_orange():   send('O')
def led_unknown():  send('U')
