var schedule = require('node-schedule');
var DEV_MODE = require('./config');

const child_process = require('child_process');
const sendEmail = require('./mail');

var compare = function (prop) {
    //降序
    return function (obj1, obj2) {
        var val1 = obj1[prop];
        var val2 = obj2[prop];
        if (!isNaN(Number(val1)) && !isNaN(Number(val2))) {
            val1 = Number(val1);
            val2 = Number(val2);
        }
        if (val1 > val2) {
            return -1;
        } else if (val1 < val2) {
            return 1;
        } else {
            return 0;
        }
    }
};

var handlerAllException = function(exceptionList) {
    var reg1 = /(com|c)\.(IbPlus|i)\.[.\w]+[\s(]/i;
    var reg2 = /IbPlus\.[.\w]+/i;
    var reg4 = /nested exception[\w\s.:]+/i;
    var reg5 = /(com|c)\.[.\w+]+/i;
    var reg6 = /o.s.w.s.server.support.DefaultHandshakeHandler/i;

    var exceptionTypeStr;
    var exceptionObjList = [];
    var searchQueryStr = '*';

    for(let j = 0; j < exceptionList.length; j++) {
        var exception = exceptionList[j].name;
        if(reg1.test(exception)) {
            exceptionTypeStr = reg1.exec(exception)[0];
            exceptionTypeStr = exceptionTypeStr.substring(0,exceptionTypeStr.length - 1);
        } else if(reg2.test(exception)) {
            exceptionTypeStr = reg2.exec(exception)[0];
        } else if(reg4.test(exception)) {
            exceptionTypeStr = reg4.exec(exception)[0];
        } else if(reg5.test(exception)) {
            exceptionTypeStr = reg5.exec(exception)[0];
        } else if(reg6.test(exception)) {
            exceptionTypeStr = reg6.exec(exception)[0];
        } else {
            console.log('不匹配类型：' + exception);
        }

        var matchExceptionFlag = false;
        for(let m = 0; m < exceptionObjList.length; m++) {
            if(exceptionObjList[m].name === exceptionTypeStr) {
                exceptionObjList[m].count++;
                matchExceptionFlag = true;
            }
        }
        if(!matchExceptionFlag) {
            exceptionObjList.push({
                name : exceptionTypeStr,
                count : 1
            });
        }

    }

    let spendTime = ((new Date().getTime()) - startDate.getTime()) / 1000 / 60;

    console.log('spend time: ' + spendTime + 'min');
    console.log('ready send email');

    var resultObj = exceptionObjList.sort(compare("count"));
    var resultBody = '';
    for(let c in resultObj) {
        if(resultObj.hasOwnProperty(c)) {
            resultBody += '<tr>'
              + '<td style="border:1px solid #CCC;padding:0 20px;">'+ resultObj[c].name +'</td>'
              + '<td style="border:1px solid #CCC;padding-left:5px;">'+ (resultObj[c].count || '') +'</td>'
              + '<td style="border:1px solid #CCC;padding-left:5px;">'+ (resultObj[c].detail || '') +'</td>'
              + '</tr>';
        }
    }
    var resultHtml = '<table style="border:1px solid #CCC;border-collapse:collapse;">'
      + '<thead style="border:1px solid #CCC;text-align:center;">'
      + '<tr>'
      + '<td style="border:1px solid #CCC;">Exception Name</td>'
      + '<td style="border:1px solid #CCC;">Count</td>'
      + '<td style="border:1px solid #CCC;">Detail</td>'
      + '</tr>'
      + '</thead>'
      + '<tbody>'
      + resultBody
      + '</tbody>'
      + '</table>';
    sendEmail(resultHtml);
};

let allProblems = [];
let count = 0;
let startDate;

function searchLog() {
    startDate = new Date();
    // const cpus = require('os').cpus();
    // console.log(cpus.length)
    // return;
    let processNum = 1;

    for(let i = 0; i < processNum; i++) {
        let worker_process = child_process.fork("search_log.js", [i, processNum]);
        worker_process.on('message', (m) => {
            count++;
            allProblems = allProblems.concat(m);
            if(count === processNum) {
                console.log('all count: ' + allProblems.length);
                handlerAllException(allProblems);
            }
        });
        worker_process.on('close', function (code) {
            console.log('child process exit, code: ' + code + ' ' + new Date());
        });
    }
}

function scheduleCronstyle(){
    if(DEV_MODE) {
        schedule.scheduleJob('0 50 * * * *', function(){
            searchLog();
        });
    } else {
        //sec(optional) min hour day month week
        schedule.scheduleJob('0 0 9 * * *', function(){
            console.log('scheduleCronstyle:' + new Date());
            searchLog();
        });
    }
}

scheduleCronstyle();