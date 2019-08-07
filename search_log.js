var ldj = require('ldjson-stream');
var http = require('http');
var sendEmail = require('./mail');

var day = 1;
var indicesNameList = [], searchIndicesCount = 0, allExceptionList = [], currentTimeStamp, earlyTimeStamp, requestData;

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
            exceptionTypeStr = 'unknow exception';
            console.log('不匹配类型：' + exception);
        }

        var matchExceptionFlag = false;
        for(let m = 0; m < exceptionObjList.length; m++) {
            if(exceptionObjList[m].name === exceptionTypeStr) {
                exceptionObjList[m].count++;
                matchExceptionFlag = true;
                break;
            }
        }
        if(!matchExceptionFlag) {
            exceptionObjList.push({
                name : exceptionTypeStr,
                count : 1
            });
        }
    }

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

function initRequestData() {
    indicesNameList = [], searchIndicesCount = 0, allExceptionList = [];
    currentTimeStamp = new Date().getTime(),
    // currentTimeStamp = new Date('8/6/2019').setHours(9,00),
    earlyTimeStamp = currentTimeStamp - day * 24 * 60 * 60 * 1000;
    requestData = {
        fields : ["@timestamp"],
        index_constraints : {}
    };
    requestData.index_constraints['@timestamp'] = {
        max_value : {
          gte : earlyTimeStamp,
          format : "epoch_millis"
        },
        min_value : {
          lte : currentTimeStamp,
          format : "epoch_millis"
        }
    };
}

function searchAllExceptionWithTimeStamp(data) {
    var post_req = http.request({
        host: '101.37.35.105',
        port : '5601',
        path: '/elasticsearch/product*normal_exception*/_field_stats?level=indices',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-ldjson',
            'kbn-version': '5.2.2'
        }
    }, function(res) {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            data += chunk;
        }).on('end', function() {
            var dataObj = JSON.parse(data);
            for(let key in dataObj.indices) {
                if(dataObj.indices.hasOwnProperty(key)) {
                    indicesNameList.push(key);
                }
            }
            for(let i = 0; i < indicesNameList.length; i++) {
                var delay = (Math.random() * 5000) + 5000;
                (function(i) {
                  setTimeout(function() {
                    console.log('共' + indicesNameList.length + '个请求，目前是第' + (i + 1) + '个请求，请求为:' + indicesNameList[i]);
                    searchExceptionByIndexName(indicesNameList[i]);
                  }, delay * i);
                })(i);
            }
        });
    });
    // post_req.setTimeout(20000);
    post_req.on('error', function(error) {
        console.log('search_all_exception:' + error);
    });
    post_req.write(data);
    post_req.end();
}

function uintToString(uintArray) {
    var encodedString = String.fromCharCode.apply(null, uintArray),
        decodedString = decodeURIComponent(escape(encodedString));
    return decodedString;
}

function searchExceptionByIndexName(indexName) {
    var paramData = '{"index":["' + indexName + '"],"ignore_unavailable":true,"preference":1530523895200}\n{"size":10000,"sort":[{"@timestamp":{"order":"desc","unmapped_type":"boolean"}}],"query":{"bool":{"must":[{"query_string":{"query":"*","analyze_wildcard":true}},{"range":{"@timestamp":{"gte":'+  earlyTimeStamp +',"lte":' + currentTimeStamp +',"format":"epoch_millis"}}}],"must_not":[]}},"highlight":{"pre_tags":["@kibana-highlighted-field@"],"post_tags":["@/kibana-highlighted-field@"],"fields":{"*":{}},"require_field_match":false,"fragment_size":2147483647},"_source":{"excludes":[]},"aggs":{"2":{"date_histogram":{"field":"@timestamp","interval":"30m","time_zone":"Asia/Shanghai","min_doc_count":1}}},"stored_fields":["*"],"script_fields":{},"docvalue_fields":["@timestamp"]}\n';
    var post_req = http.request({
        host: '101.37.35.105',
        port : '5601',
        path: '/elasticsearch/_msearch',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-ldjson',
            'kbn-version': '5.2.2'
        }
    }, function(res) {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', function (res) {
            data += res;
        }).on('end', function() {
            let res = JSON.parse(data);
            for(let t = 0; t < res.responses[0].hits.hits.length; t++) {
                allExceptionList.push({
                    name : res.responses[0].hits.hits[t]._source.message
                });
            }
            searchIndicesCount++;
            if(searchIndicesCount == indicesNameList.length) {
                handlerAllException(allExceptionList);
                indicesNameList = [];
                allExceptionList = [];
                searchIndicesCount = 0;
            }
        });
    });
    // post_req.setTimeout(10000);
    post_req.on('error', function(error) {
        console.log('search_exception:' + error);
    });
    post_req.write(paramData);
    post_req.end();
}

function searchExceptionLog() {
    initRequestData();
    var serialize = ldj.serialize();
    serialize.on('data', function(json) {
        searchAllExceptionWithTimeStamp(json);
    });
    serialize.write(requestData);
    serialize.end();
}

module.exports = searchExceptionLog;