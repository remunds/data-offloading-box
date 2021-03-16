**# Nature 4.0**

Conservation strategies require the observation and assessment of landscape. Expert surveys must make trade-offs here between level of detail, spatial coverage, and temporal repetition, which are only partially resolved even by resorting to airborne or satellite-based remote sensing approaches. This limits differentiated conservation planning and response options.



**# Getting Started**

**## Requirements**

\1. (tested on) Raspberry Pi 4 B, at least 4GB RAM recommended

\2. [Raspios 64 bit](https://downloads.raspberrypi.org/raspios_arm64/images/) (raspios_arm64-2020-08-24 and higher)

\3. User named "pi"



**## Installation**

**### Configure**

Download repository via github

\```

cd /home/pi/

git clone https://github.com/remunds/data-offloading-box.git

cd data-offloading-box

nano config_default.json

\```

Then edit your specific details, such as backend IP, backend Port, db IP, db Port, dtnd IP and dtnd Port.

In a normal use case, you just have to adjust the backend IP to a static and globally available IP adress, leading to your this backend server. (TODO)

Do not change "configuration" and "nodeName"





\```

./setup.sh

sudo mv dtnd.service /lib/systemd/system/

sudo mv offloading.service /lib/systemd/system/ 

./start.sh

\```

Now the box server should run in background and should start itself automatically after restart or crash.

**#### For debugging purposes, you can run**

\```

sudo systemctl status offloading.service

sudo systemctl status dtnd.service

sudo systemctl status mongod.service

\```



**#### terminate the process**

\```

sudo systemctl stop offloading.service

sudo systemctl stop dtnd.service

\``` 



**#### start again**

\```

./start.sh

\```

or

\```

sudo systemctl start dtnd.service

sudo systemctl start mongod.service

sudo systemctl start offloading.service

\```



**## Editing data structures**



\* schemas



**## Storing in the database**



**## Add new Task**

\* taskgeneratior.js -> adding new tasks with title/description/...



**## dtnd**

dtnd is a delay-tolerant networking daemon. It represents a node inside the network and is able to transmit, receive and forward bundles to other nodes. A node's neighbors may be specified in the configuration or detected within the local network through a peer discovery. Bundles might be sent and received through a REST-like web interface. The features and their configuration is described inside the provided example configuration.toml.



**# License**

This project's code is licensed under the GNU General Public License version 3 (GPL-3.0-or-later).