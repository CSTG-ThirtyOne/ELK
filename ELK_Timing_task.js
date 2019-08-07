var schedule = require('node-schedule');
var searchLog = require('./search_log');
var DEV_MODE = require('./config');

function scheduleCronstyle(){
    //sec(optional) min hour day month week
    schedule.scheduleJob('0 0 9 * * *', function(){
        console.log('scheduleCronstyle:' + new Date());
        searchLog();
    }); 
}

DEV_MODE ? searchLog() : scheduleCronstyle();