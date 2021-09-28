from matplotlib import pyplot as plt

from gpiozero import CPUTemperature
from datetime import datetime
import time

cpu = CPUTemperature()
hour = datetime.now().hour
x = []
y = []
while True:
    date = datetime.today().strftime('%Y-%m-%d')
    time_now = datetime.now().strftime('%H-%M')
    if(datetime.now().minute % 6 == 0):
        print(cpu.temperature)
        print(datetime.now().minute)
        x.append(datetime.now().minute)
        y.append(cpu.temperature)
        print("Saved a Temperature at minute: " + str(datetime.now().minute))
        time.sleep(360)


    if((hour < datetime.now().hour) | (hour == 23 & datetime.now().hour == 0)):
        plt.bar(x,y,color = 'g', width= 0.72, label = "Temperature")
        plt.xlabel('Time')
        plt.ylabel('Temperature')
        plt.title('Temperature of ' + date + ' ' + time_now)
        plt.savefig('/home/pi/sensor_data/cpu_temperature_' + date + '_' + time_now +  '.png', dpi=200)
        print("Saved Plot")
        hour = datetime.now().hour
        x.clear
        y.clear
        
