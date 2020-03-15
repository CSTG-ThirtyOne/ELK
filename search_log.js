var ldj = require('ldjson-stream');
const axios = require('axios');

let allProblems = [];

function singleSearchRequest(indexName, earlyTimeStamp, currentTimeStamp) {
    var paramData = '{"index":["' + indexName + '"],"ignore_unavailable":true,"preference":1530523895200}\n{"size":10000,"sort":[{"@timestamp":{"order":"desc","unmapped_type":"boolean"}}],"query":{"bool":{"must":[{"query_string":{"query":"*","analyze_wildcard":true}},{"range":{"@timestamp":{"gte":'+  earlyTimeStamp +',"lte":' + currentTimeStamp +',"format":"epoch_millis"}}}],"must_not":[]}},"highlight":{"pre_tags":["@kibana-highlighted-field@"],"post_tags":["@/kibana-highlighted-field@"],"fields":{"*":{}},"require_field_match":false,"fragment_size":2147483647},"_source":{"excludes":[]},"aggs":{"2":{"date_histogram":{"field":"@timestamp","interval":"30m","time_zone":"Asia/Shanghai","min_doc_count":1}}},"stored_fields":["*"],"script_fields":{},"docvalue_fields":["@timestamp"]}\n';

    return new Promise(resolve => {
        axios.post('http://101.37.35.105:5601/elasticsearch/_msearch',
          paramData,{
              headers: {
                  'Content-Type': 'application/x-ldjson',
                  'kbn-version': '5.2.2'
              }
          }).then(res => {
            resolve(res.data);
        });
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
                allRequest.push(singleSearchRequest(indicesNameList[i], earlyTime, currentTime));
            }

            Promise.all(allRequest).then(datas => {
                //datas array
                //datas[0]  object {responses : array}
                if(datas.length === 0) {
                    resolve([]);
                    return;
                }
                let allExceptionList = [];
                for(let i = 0; i < datas.length; i++) {
                    let responses = datas[i].responses;
                    if(!responses || responses.length === 0) {
                        continue;
                    }
                    let hits = responses[0].hits.hits;
                    for(let t = 0; t < hits.length; t++) {
                        allExceptionList.push({
                            name : hits[t]._source.message
                        });
                    }
                }
                resolve(allExceptionList);
            });
        });
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


        Promise.all(getAllIndicesPromise).then(allExceptions => {
            for(let i = 0; i < allExceptions.length; i++) {
                allProblems = allProblems.concat(allExceptions[i]);
            }
            //处理所有exception
            process.send(allProblems);
        });

    })

}

const param = process.argv[2];
const processNum = process.argv[3];
// const currentTime = new Date('3/14/2020').setHours(9, 0);//调试
const currentTime = new Date().setHours(9, 0);
process.send = process.send || function () {};

if(param) {
    let hours = 24 / (Number(processNum));
    serializeOneHour(currentTime, Number(param), hours);
}