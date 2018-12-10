const uuid = require('uuid').v4;
const _ = require('lodash');
const request = require('request');
const {DOMAIN} = require('../config');

const stockSearchUrl = "https://7vudjag5n8.execute-api.ap-northeast-2.amazonaws.com/v1/stocks";

let myKey = "";

class Directive {
    constructor({namespace, name, payload}) {
        this.header = {
            messageId: uuid(),
            namespace: namespace,
            name: name,
        }
        this.payload = payload
    }
}

function resultText({midText, sum, diceCount}) {
    if (diceCount == 1) {
        return `결과는 ${sum}입니다.`
    } else if (diceCount < 4) {
        return `결과는 ${midText} 이며 합은 ${sum} 입니다.`
    } else {
        return `주사위 ${diceCount}개의 합은 ${sum} 입니다.`
    }
}

function getStock(stockName) {
    return new Promise(function (resolve) {
        request.post({
            url: stockSearchUrl,
            form: JSON.stringify({stockID: stockName})
        }, function (err, httpResponse, body) {
            if (err) {
                return console.error('Request failed:', err);
            }
            let result = JSON.parse(body).stockID;
            console.log('Request Success! Server responded with:', result);
            resolve(result);
        });
    });
}

function throwDice(diceCount) {
    const results = [];
    let midText = '';
    let resultText = '';
    let sum = 0;
    console.log(`throw ${diceCount} times`);
    for (let i = 0; i < diceCount; i++) {
        const rand = Math.floor(Math.random() * 6) + 1;
        console.log(`${i + 1} time: ${rand}`);
        results.push(rand);
        sum += rand;
        midText += `${rand}, `
    }

    midText = midText.replace(/, $/, '')
    return {midText, sum, diceCount}
}

class CEKRequest {
    constructor(httpReq) {
        this.request = httpReq.body.request;
        this.context = httpReq.body.context;
        this.session = httpReq.body.session;
        console.log(`CEK Request: ${JSON.stringify(this.context)}, ${JSON.stringify(this.session)}`)
    }

    do(cekResponse) {
        switch (this.request.type) {
            case 'LaunchRequest':
                return this.launchRequest(cekResponse);
            case 'IntentRequest':
                return this.intentRequest(cekResponse);
            case 'SessionEndedRequest':;
                return this.sessionEndedRequest(cekResponse)
        }
    }

    launchRequest(cekResponse) {
        console.log('launchRequest');
        cekResponse.setSimpleSpeechText('안녕하세요. 경희대 최신기술 프로젝트 F조의 주식 알리미입니다.')
        /*
      cekResponse.setMultiturn({
        intent: 'ThrowDiceIntent',
      })
      */
    }

    intentRequest(cekResponse) {
        console.log('intentRequest');
        console.dir(this.request);
        const intent = this.request.intent.name;
        const slots = this.request.intent.slots;

        switch (intent) {
            case 'searchIntent':
                let searchKey = "";
                var myResult = '';
                cekResponse.appendSpeechText('요청하신 주식을 검색할게요');
                console.log(slots.valueOf()); // 예시 { StockNameSlot: { name: 'StockNameSlot', value: '네이버 주식' } }
                const searchKeySlot = slots.StockNameSlot;
                if (slots.length != 0 && searchKeySlot) {
                    searchKey = searchKeySlot.value;
                    myKey = searchKey;
                    /*
                    request.post({
                        url: stockSearchUrl,
                        form: JSON.stringify({stockID: searchKey})
                    }, function callback(err, httpResponse, body) {
                        if (err) {
                            return console.error('Request failed:', err);
                        }

                        console.log('Request Success! Server responded with:', JSON.parse(body).stockID);
                        myResult = JSON.parse(body).stockID;
                        let mySpeach = "요청하신 주식은" + myResult + "입니다.";
                        console.log(mySpeach);
                        cekResponse.appendSpeechText(mySpeach);
                    });
                    */
                    /*
                    getStock(searchKey).then(function (stockData) {
                        cekResponse.appendSpeechText("요청하신 주식은" + stockData + "입니다.");
                    });
                    */
                } else {
                    // 슬롯에 아무것도 없는 경우이므로 multiturn 응답을 통해 사용자에게 다시 회사명을 말해달라고 요청
                    cekResponse.setSimpleSpeechText('죄송해요, 회사를 찾지 못했어요. 앞으로 서비스해 드리기 위해 회사명을 다시 한번만 말해주세요.')
                    cekResponse.setMultiturn({
                     intent: 'AddCompanyIntent',
                    });
                }
                console.log(searchKey);
                /* TODO dev Blueprint
                const stockResult = searchOnWeb(searchKey); 받은 주식값으로 검색 함수에 넣어서 값 반환 받기
                결과 나오면 appendSpeechText 로 아래 resultText 처럼 함수 하나 만들어서 클로바로 출력하고
                다이나모 디비에 저장!
*/
                break;
            case 'AddCompanyIntent':
                console.log('AddCompanyIntent ! ');
                break;
            case 'ThrowDiceIntent':
            default:
                let diceCount = 1;
                cekResponse.appendSpeechText(`주사위를 ${diceCount}개 던집니다.`);
                cekResponse.appendSpeechText({
                    lang: 'ko',
                    type: 'URL',
                    value: `${DOMAIN}/rolling_dice_sound.mp3`,
                });
                const throwResult = throwDice(diceCount);
                cekResponse.appendSpeechText(resultText(throwResult));
                break

        }

        if (this.session.new == false) {
            cekResponse.setMultiturn()
        }
    }

    sessionEndedRequest(cekResponse) {
        console.log('sessionEndedRequest');
        cekResponse.setSimpleSpeechText('주사위 놀이 익스텐션을 종료합니다.');;
        cekResponse.clearMultiturn()
    }
}

class CEKResponse {
    constructor() {
        console.log('CEKResponse constructor')
        this.response = {
            directives: [],
            shouldEndSession: true,
            outputSpeech: {},
            card: {},
        }
        this.version = '0.1.0'
        this.sessionAttributes = {}
    }

    setMultiturn(sessionAttributes) {
        this.response.shouldEndSession = false
        this.sessionAttributes = _.assign(this.sessionAttributes, sessionAttributes)
    }

    clearMultiturn() {
        this.response.shouldEndSession = true
        this.sessionAttributes = {}
    }

    setSimpleSpeechText(outputText) {
        this.response.outputSpeech = {
            type: 'SimpleSpeech',
            values: {
                type: 'PlainText',
                lang: 'ko',
                value: outputText,
            },
        }
    }

    appendSpeechText(outputText) {
        const outputSpeech = this.response.outputSpeech
        if (outputSpeech.type != 'SpeechList') {
            outputSpeech.type = 'SpeechList'
            outputSpeech.values = []
        }
        if (typeof(outputText) == 'string') {
            outputSpeech.values.push({
                type: 'PlainText',
                lang: 'ko',
                value: outputText,
            })
        } else {
            outputSpeech.values.push(outputText)
        }
    }
}

const clovaReq = function (httpReq, httpRes, next) {
    cekResponse = new CEKResponse();
    cekRequest = new CEKRequest(httpReq);
    cekRequest.do(cekResponse);
    if (myKey.length != 0) {
        getStock(myKey).then(function (stockData) {
            cekResponse.appendSpeechText("요청하신 주식은" + stockData + "입니다.");
            console.log(`CEKResponse: ${JSON.stringify(cekResponse)}`);
            return httpRes.send(cekResponse);
        });
    }else{
        console.log(`CEKResponse: ${JSON.stringify(cekResponse)}`);
        return httpRes.send(cekResponse);
    }
    myKey = "";
};;

module.exports = clovaReq;
