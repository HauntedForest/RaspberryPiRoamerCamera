#!/bin/bash
echo Startup script executed
screen -S 'HF-PhoneHome' -dm bash -c "cd /home/pi/CameraServer/; npm run dev"