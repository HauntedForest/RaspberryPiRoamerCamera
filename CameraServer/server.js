const express = require('express');
const piWifi = require('pi-wifi');
const EricsPiUtilities = require("./EricsPiUtilities.js");
const cors = require('cors')
const Config = require("./config.json");
const app = express();

app.use(cors()); //allow users to access all rutes reguardless of if its local or not

app.get('/status', (req, res) => {

    var objRoot = new Object();
    objRoot.procUptime = Math.floor(process.uptime() * 1000);

    var objRAM = new Object();
    var objCPU = new Object();
    var objWiFi = new Object();

    EricsPiUtilities.getMemoryInfo((err, ram) => {
        if (err) {
            objRAM.error = err.message;
            console.error("Failed to get memory info:");
            console.error(err);
        }
        else {
            objRAM = ram;
            //console.log("Memory:", ram);
        }

        EricsPiUtilities.getCPUInfo((err, cpu) => {
            if (err) {
                objCPU.error = err.message;
                console.error("Failed to get CPU info:");
                console.error(err);
            }
            else {
                objCPU = cpu;
                // console.log("CPU:", cpu);
            }

            piWifi.status(Config.wlan, function (err, network) {
                var firstNetworkErrored = false;
                if (err) {
                    firstNetworkErrored = true;
                    objWiFi.error = err.message;
                    console.error("Wifi:", err.message);
                }
                else {
                    objWiFi.apmac = network.bssid;
                    objWiFi.ssid = network.ssid;
                    objWiFi.ip = network.ip;
                    objWiFi.mac = network.mac;
                    objWiFi.uuid = network.uuid;
                    //console.log("WiFi:", network);
                }

                EricsPiUtilities.getWifiSignalStrength(Config.wlan, (err, sig) => {
                    if (!err) {
                        objWiFi.signalLevel = sig;
                    }

                    EricsPiUtilities.getOSUptime((err, uptime) => {
                        EricsPiUtilities.getCPUTemp((err, cputemp) => {



                            EricsPiUtilities.getThrottledState((err, throttledError) => {



                                objRoot.osUptime = uptime;
                                objRoot.tempature = cputemp;
                                objRoot.throttledError = throttledError;

                                objRoot.ram = objRAM;
                                objRoot.cpu = objCPU;
                                objRoot.wifi = objWiFi;
                                res.json(objRoot);
                            });
                        });
                    });

                    //console.log(sig);
                });

            });

        });

    });

});

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(Config.port, () => {
    console.log("Hello! I am: " + Config.name);
    console.log("Using: " + (Config.wlan == 'wlan0' ? "Built in Wifi" : (Config.wlan == 'wlan1' ? "External Wifi Card" : "Unknown: " + Config.wlan)));
    piWifi.status(Config.wlan, function (err, network) {
        if (err) {
            console.error("Failed to get IP address:", err.message);
        }
        else {
            console.log("IP: " + network.ip + ":" + Config.port);
        }

    });
})