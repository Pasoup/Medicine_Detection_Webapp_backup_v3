import serial
import time

_ser = None



def connect(port="COM7", baud=9600):
    global _ser
    _ser = serial.Serial(port, baud, timeout=1)
    time.sleep(2)  # wait for Arduino to finish resetting
    led_white()



def send(cmd: str):
    if _ser and _ser.is_open:
        _ser.write(cmd.encode())



def led_white():    send('1')
def led_off():      send('0')
def led_green():    send('G')
def led_red():      send('R')
def led_orange():   send('O')