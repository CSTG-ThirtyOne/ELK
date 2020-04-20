var ldj = require('ldjson-stream');
const axios = require('axios');

let allProblems = [];

let finishReqCount = 0;

function singleSearchRequest(indexName, earlyTimeStamp, currentTimeStamp) {
    var paramData = '{"index":["' + indexName + '"],"ignore_unavailable":true,"preference":1530523895200}\n{"size":10000,"sort":[{"@timestamp":{"order":"desc","unmapped_type":"boolean"}}],"query":{"bool":{"must":[{"query_string":{"query":"*","analyze_wildcard":true}},{"range":{"@timestamp":{"gte":'+  earlyTimeStamp +',"lte":' + currentTimeStamp +',"format":"epoch_millis"}}}],"must_not":[]}},"highlight":{"pre_tags":["@kibana-highlighted-field@"],"post_tags":["@/kibana-highlighted-field@"],"fields":{"*":{}},"require_field_match":false,"fragment_size":2147483647},"_source":{"excludes":[]},"aggs":{"2":{"date_histogram":{"field":"@timestamp","interval":"30m","time_zone":"Asia/Shanghai","min_doc_count":1}}},"stored_fields":["*"],"script_fields":{},"docvalue_fields":["@timestamp"]}\n';

    return axios.post('http://101.37.35.105:5601/elasticsearch/_msearch',
      paramData,{
          headers: {
              'Content-Type': 'application/x-ldjson',
              'kbn-version': '5.2.2'
          },
          timeout : 300000
      });
}

//查询一个时段内的所有indices
function getAllIndices(data, earlyTime, currentTime) {
    return new Promise(resolve => {
        axios.post('http://101.37.35.105:5601/elasticsearch/product*normal_exception*/_field_stats?level=indices',
          data,{
              headers: {
                  'Content-Type': 'application/x-ldjson',
                  'kbn-version': '5.2.2'
              }
          }).then(res => {
            let dataObj = res.data;
            let indicesNameList = [];
            for(let key in dataObj.indices) {
                if(dataObj.indices.hasOwnProperty(key)) {
                    indicesNameList.push(key);
                }
            }

            if(indicesNameList.length === 0) {
                resolve([]);
                return;
            }

            //构造所有搜索内容的请求
            let allRequest = [];
            for(let i = 0; i < indicesNameList.length; i++) {
                // allRequest.push(singleSearchRequest(indicesNameList[i], earlyTime, currentTime));

                allRequest.push({
                    indicesName : indicesNameList[i], earlyTime, currentTime
                });
            }

            resolve(allRequest);

        });
    });
}

//递归处理请求
function handleReq(reqList, index) {
    let startTime = new Date().getTime();
    let {indicesName, earlyTime, currentTime} = reqList[index];
    let req = singleSearchRequest(indicesName, earlyTime, currentTime);
    req.then(reqRes => {
        finishReqCount++;
        console.log('已结束的请求数：' + finishReqCount + `; 耗时:${new Date().getTime() - startTime}`);
        let {responses} = reqRes.data;
        if(responses && responses.length > 0) {
            let allExceptionList = [];
            try {
                for(let i = 0; i < responses.length; i++) {
                    let hits = responses[i].hits.hits;
                    for(let t = 0; t < hits.length; t++) {
                        allExceptionList.push({
                            name : hits[t]._source.message
                        });
                    }
                }
            }
            catch(error) {
                console.error(error);
            }
            allProblems = allProblems.concat(allExceptionList);
        }
        index++;
        if(reqList.length === index + 1) {
            process.send(allProblems);
        } else {
            console.log(`开始第${index+1}个请求`);
            handleReq(reqList, index);
        }
    }).catch(() => {
        console.log(`重试第${index+1}个请求`);
        handleReq(reqList, index);
    });
}


//24小时切分，再进行汇总
function serializeOneHour(baseTime, stage, hours) {
    let currentTime = baseTime - stage * hours * 60 * 60 * 1000;
    let oneHourTime = 60 * 60 * 1000;
    let requestDatas = [];

    for(let i = hours; i >= 1; i--) {
        let _earlyTime = currentTime - i * oneHourTime;
        let _currentTime = currentTime - (i - 1) * oneHourTime;
        let requestData = {
            fields : ["@timestamp"],
            index_constraints : {}
        };
        requestData.index_constraints['@timestamp'] = {
            max_value : {
                gte : _earlyTime,
                format : "epoch_millis"
            },
            min_value : {
                lte : _currentTime,
                format : "epoch_millis"
            }
        };
        requestDatas.push(new Promise(resolve => {
            let serialize = ldj.serialize();
            serialize.on('data', function(json) {
                resolve({
                    json,
                    earlyTime : _earlyTime,
                    currentTime : _currentTime
                });
            });
            serialize.write(requestData);
            serialize.end();
        }));
    }

    Promise.all(requestDatas).then(datas => {
        let getAllIndicesPromise = datas.map(data => {
            let {json, earlyTime, currentTime} = data;
            return getAllIndices(json, earlyTime, currentTime);
        });

        let allReqPromise = [];
        Promise.all(getAllIndicesPromise).then(datas => {
            for(let i = 0; i < datas.length; i++) {
                allReqPromise = allReqPromise.concat(datas[i]);
            }
            console.log(allReqPromise.length);
            //同步处理所有请求
            handleReq(allReqPromise, 0);
        });

    })

}

const param = process.argv[2];
const processNum = process.argv[3];
// const currentTime = new Date('3/15/2020').setHours(9, 0);//调试
const currentTime = new Date().setHours(9, 0);
process.send = process.send || function () {};

if(param) {
    let hours = 24 / (Number(processNum));
    serializeOneHour(currentTime, Number(param), hours);
}