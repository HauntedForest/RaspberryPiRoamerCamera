var fs = require('fs');
var exec = require('child_process').exec;

var memInfo = {};
var currentCPUInfo = { total: 0, active: 0 };
var lastCPUInfo = { total: 0, active: 0 };

function getValFromLine(line) {
  var match = line.match(/[0-9]+/gi);
  if (match !== null)
    return parseInt(match[0]);
  else
    return null;
}

var getMemoryInfo = function (cb) {
  fs.readFile('/proc/meminfo', 'utf8', function (err, data) {
    if (err) {
      cb(err);
      return;
    }
    var lines = data.split('\n');
    memInfo.total = Math.floor(getValFromLine(lines[0]) / 1024);
    memInfo.free = Math.floor(getValFromLine(lines[1]) / 1024);
    memInfo.cached = Math.floor(getValFromLine(lines[3]) / 1024);
    memInfo.used = memInfo.total - memInfo.free;
    memInfo.percentUsed = Math.ceil(((memInfo.used - memInfo.cached) / memInfo.total) * 100);

    cb(null, memInfo);
  });
};

var calculateCPUPercentage = function (oldVals, newVals) {
  var totalDiff = newVals.total - oldVals.total;
  var activeDiff = newVals.active - oldVals.active;
  return Math.ceil((activeDiff / totalDiff) * 100);
};

var getCPUInfo = function (cb) {
  lastCPUInfo.active = currentCPUInfo.active;
  lastCPUInfo.idle = currentCPUInfo.idle;
  lastCPUInfo.total = currentCPUInfo.total;

  fs.readFile('/proc/stat', 'utf8', function (err, data) {
    if (err) {
      if (cb !== undefined)
        cb(err);
      return;
    }
    var lines = data.split('\n');
    var cpuTimes = lines[0].match(/[0-9]+/gi);
    currentCPUInfo.total = 0;
    // We'll count both idle and iowait as idle time
    currentCPUInfo.idle = parseInt(cpuTimes[3]) + parseInt(cpuTimes[4]);
    for (var i = 0; i < cpuTimes.length; i++) {
      currentCPUInfo.total += parseInt(cpuTimes[i]);
    }
    currentCPUInfo.active = currentCPUInfo.total - currentCPUInfo.idle
    currentCPUInfo.percentUsed = calculateCPUPercentage(lastCPUInfo, currentCPUInfo);

    if (cb !== undefined)
      cb(null, currentCPUInfo);
  });
};

var getOSUptime = function (cb) {

  fs.readFile('/proc/uptime', 'utf8', function (err, data) {
    if (err) {
      if (cb !== undefined)
        cb(err);
      return;
    }
    var lines = data.split(' ');
    var uptime = parseFloat(lines[0]) * 1000;

    if (cb !== undefined) {
      cb(null, uptime);
    }
  });
};

var getWifiSignalStrength = function (wlan, cb) {

  exec("iwconfig " + wlan + " | grep Link", (error, stdout, stderr) => {

    if (error) {
      if (cb !== undefined)
        cb(error);
      return;
    }

    var newStr = stdout;
    newStr = newStr.trim();
    newStr = newStr.split("  ");
    var signalLevel = newStr[1];
    signalLevel = signalLevel.replace("Signal level=", "");
    signalLevel = signalLevel.replace(" dBm", "")
    signalLevel = parseInt(signalLevel);

    var signalLevelPercent = map(signalLevel, -35, -60, 100, 0); //very rough
    if (signalLevelPercent > 100) {
      signalLevelPercent = 100;
    }
    else if (signalLevelPercent < 0) {
      signalLevelPercent = 0;
    }

    var json = { dBm: signalLevel, percent: signalLevelPercent };

    if (cb !== undefined) {
      cb(null, json);
    }

  });

};

var getCPUTemp = function (cb) {

  exec("vcgencmd measure_temp", (error, stdout, stderr) => {

    if (error) {
      if (cb !== undefined)
        cb(error);
      return;
    }

    var tempC = stdout;
    tempC = tempC.trim();
    tempC = tempC.replace("temp=", "");
    tempC = tempC.replace("'C", "");
    tempC = parseFloat(tempC);
    var tempF = tempC * 9 / 5 + 32;
    var report = {
      c: tempC,
      f: tempF
    }
    if (cb !== undefined) {
      cb(null, report);
    }

  });

};

/*

Bit	  Hex value	  Meaning
0	    1	          Under-voltage detected
1	    2	          Arm frequency capped
2	    4	          Currently throttled
3	    8	          Soft temperature limit active
16    10000	      Under-voltage has occurred
17	  20000	      Arm frequency capping has occurred
18	  40000	      Throttling has occurred
19	  80000	      Soft temperature limit has occurred

*/

var throttledMessages = {
  0: 'Under-voltage!',
  1: 'ARM frequency capped!',
  2: 'Currently throttled!',
  3: 'Soft temperature limit active',
  16: 'Under-voltage has occurred since last reboot.',
  17: 'Throttling has occurred since last reboot.',
  18: 'ARM frequency capped has occurred since last reboot.',
  19: 'Soft temperature limit has occurred'
}

var getThrottledState = function (cb) {

  exec("vcgencmd get_throttled", (error, stdout, stderr) => {

    if (error) {
      if (cb !== undefined)
        cb(error);
      return;
    }

    var temp = stdout;
    temp = temp.trim();
    temp = temp.replace("throttled=0x", "");
    var num = parseInt(temp, 16);
    var messages = [];
    for (var i in throttledMessages) {
      if ((num & (1 << i)) != 0) {
        messages.push(throttledMessages[i]);
      }
    }

    // if(messages.length == 0) {
    //   messages.push("No error");
    // }


    if (cb !== undefined) {
      cb(null, messages);
    }

  });

};

function map(x, in_min, in_max, out_min, out_max) {
  return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}



module.exports = {
  getMemoryInfo: getMemoryInfo,
  getCPUInfo: getCPUInfo,
  getOSUptime: getOSUptime,
  getWifiSignalStrength: getWifiSignalStrength,
  getCPUTemp: getCPUTemp,
  getThrottledState: getThrottledState
};