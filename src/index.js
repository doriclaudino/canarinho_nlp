import JaroWrinker from 'jaro-winkler';
import {
    sourceGroups,
    targetGroups
} from "./initialgroups";
import {
    htmlElements,
    localStorageKey,
    witConfig,
    spammConfig
} from "./config";

/**
 * find element by id and tranverse all childNodes define on path
 * @param {lookup htmlElements key} name 
 */
function getHtmlElement(name) {
    if (!htmlElements[name]) {
        return false;
    }
    var finder = htmlElements[name];
    var parent = document.getElementById(finder.id);
    parent = !parent ? document.body : parent;

    if (!finder.path)
        return parent;

    var path = finder.path;
    path.forEach(function (pos) {
        if (!parent.childNodes[pos]) {
            return false;
        }
        parent = parent.childNodes[pos];
    });
    return parent;
}


// Dispath an event (of click, por instance)
function eventFire(el, etype) {
    var evt = document.createEvent("MouseEvents");
    evt.initMouseEvent(etype, true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
    el.dispatchEvent(evt);
}


// Select a chat to show the main box
async function selectChat(chat) {
    const title = chat.querySelector('span[dir="auto"]').title;
    eventFire(chat.firstChild.firstChild.firstChild, 'mousedown'); //need it for business version?
    eventFire(chat.firstChild.firstChild, 'mousedown');
    var count = 0;
    let promise = new Promise((resolve, reject) => {
        var interval = setInterval(() => {
            count++;
            const titleMain = getHtmlElement("selected_title").title;

            if (titleMain) {
                clearInterval(interval);
                resolve(titleMain === title)
            } else if (count > 20) {
                clearInterval(interval);
                reject('selectChat - maximum 20 times reached')
            }
        }, 300);
    });
    return promise;
}


function cleanChatData(htmlElement) {
    let reactComponent = findReactComponent(htmlElement);

    let data = reactComponent.props.data.data || null
    if (!data || !data.isGroup) return null;

    let rawData = reactComponent.props.data.data
    let cleanedData = cleanGroupData(rawData)
    cleanedData['htmlElement'] = htmlElement
    return cleanedData
}



/**
 * get elements from html chat list
 */
function getChatsHtmlAndBasicInformation() {
    let html = getHtmlElement('chatList')
    let total = html.childNodes[0].childElementCount

    let reactElements = {}
    for (let index = 0; index < total; index++) {
        let htmlElement = html.childNodes[0].childNodes[index];
        let cleanedData = cleanChatData(htmlElement)
        if (!cleanedData) continue;
        reactElements[cleanedData.id] = cleanedData
    }
    return reactElements
}

/**
 * find react component based on htmlNode
 * @param {*} htmlNodeElement 
 */
function findReactComponent(htmlNodeElement) {
    for (const key in htmlNodeElement) {
        if (key.startsWith('__reactInternalInstance$')) {
            const fiberNode = htmlNodeElement[key];
            return fiberNode && fiberNode.return && fiberNode.return.stateNode;
        }
    }
    return null;
};



/**
 * select usefull chat data
 */
function cleanGroupData(raw) {
    let last = raw.msgs._last;
    let participants = {}
    let participantsLength = 0
    Object.entries(raw.groupMetadata.participants._index).map(keyAndValue => {
        let key = keyAndValue[0]
        let value = keyAndValue[1]
        participants[value.id.user] = cleanParticipantData(value)
        participantsLength++
    })

    let msgs = {}
    let msgLength = 0
    let minTimestamp = Infinity
    let maxTimestamp = 0 //should be equals to the lastMessage
    Object.entries(raw.msgs._index).map(keyAndValue => {
        let key = keyAndValue[0]
        let value = keyAndValue[1]
        let cleanedMsgData = cleanMsgData(value)

        minTimestamp = Math.min(minTimestamp, cleanedMsgData.t)
        maxTimestamp = Math.max(maxTimestamp, cleanedMsgData.t)

        //not a chat? we skip
        if (cleanedMsgData.type !== 'chat') return false

        delete cleanedMsgData['type']
        let tempText = removeDoubleSpaces(cleanedMsgData.text)

        //not pass the extended rules we skip
        if (!passExtendedCleanRules(tempText)) return false

        msgs[value.id.id] = cleanedMsgData
        msgLength++

    })

    return {
        name: raw.name,
        id: raw.id.user,
        msgs,
        msgLength,
        minTimestamp,
        maxTimestamp,
        formattedTitle: raw.formattedTitle,
        lastMessage: last ? {
            text: last.text,
            timestamp: last.t,
            id: last.id.id,
            senderId: last.sender ? last.sender.user : undefined
        } : undefined,
        createdAt: raw.groupMetadata.creation,
        groupInviteLink: raw.groupMetadata.groupInviteLink,
        restrict: raw.groupMetadata.restrict,
        desc: raw.groupMetadata.desc,
        owner: raw.groupMetadata.owner.user,
        participants,
        participantsLength
    }
}

/** set of rules */
function passExtendedCleanRules(str) {
    //invalid length
    if (!allowedLength(str)) return false

    //single email on string?
    if (isEmpty(removeEmail(str))) return false

    //single url on string?
    if (isEmpty(removeUrl(str))) return false

    //single phone on string?
    if (isEmpty(removePhoneNumber(str))) return false

    //single emojilist on string?
    if (isEmpty(removeEmoji(str))) return false
    return true
}

function allowedLength(str) {
    return !isEmpty(str) && str.length > 19 && str.length < 281
}

function removeEmail(str) {
    return str.replace(/(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})/gmi, '')
}

function removeUrl(str) {
    return str.replace(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gmi, '')
}

//https://regex101.com/r/dUAl4h/4
function removePhoneNumber(str) {
    return str.replace(/(([+\s]?\d{1,3})?([\s\d\(-\.])?\d{1,4}([\s\d\(-\.]{1,2})?\d{1,4}([\s\d\(-\.])?\d{1,4}([\s\d\(-\.])?\d{1,4})/gmi, '')
}

function isEmpty(str) {
    return str.trim().length === 0
}

function removeDoubleSpaces(str) {
    const regex = /\s{2,}/gmi;
    return str.replace(regex, ' ')
}

function removeEmoji(str) {
    const emoji = /([#0-9]\u20E3)|[\xA9\xAE\u203C\u2047-\u2049\u2122\u2139\u3030\u303D\u3297\u3299][\uFE00-\uFEFF]?|[\u2190-\u21FF][\uFE00-\uFEFF]?|[\u2300-\u23FF][\uFE00-\uFEFF]?|[\u2460-\u24FF][\uFE00-\uFEFF]?|[\u25A0-\u25FF][\uFE00-\uFEFF]?|[\u2600-\u27BF][\uFE00-\uFEFF]?|[\u2900-\u297F][\uFE00-\uFEFF]?|[\u2B00-\u2BF0][\uFE00-\uFEFF]?|(?:\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDEFF])[\uFE00-\uFEFF]?|[\u20E3]|[\u26A0-\u3000]|\uD83E[\udd00-\uddff]|[\u00A0-\u269F]/gmi;
    return str.replace(emoji, "");
}

function cleanMsgData(obj) {
    return {
        text: obj.text,
        senderId: obj.sender ? obj.sender.user : undefined,
        type: obj.type,
        t: obj.t,
    }
}

function cleanParticipantData(obj) {
    return {
        id: obj.id.user,
        name: obj.contact.notifyName,
        altname: obj.contact.displayName,
        img: obj.contact.profilePicThumb ? obj.contact.profilePicThumb.img : undefined
    }
}

/**
 * format the sender object
 * we can memoize it on future
 */
function cleanSenderData(obj) {
    if (!obj || obj.sender === undefined)
        return undefined
    return {
        id: obj.sender ? obj.sender.user : undefined
    }
}


function cleanLocalStorage() {
    return localStorage.removeItem(localStorageKey)
}

function save(data) {
    return localStorage.setItem(localStorageKey, JSON.stringify(data))
}

function load(parse = true) {
    if (parse)
        return JSON.parse(localStorage.getItem(localStorageKey)) || {}
    else
        return localStorage.getItem(localStorageKey)
}

//groups to read information
function getSourceGroups() {
    return sourceGroups
}

//groups to reshare
function getTargetGroups() {
    return targetGroups
}

function reachDate(msgs, desiredTimestamp) {
    return msgs.find(e => e.t < desiredTimestamp)
}

function loadMoreMsgs() {
    let htmlLoader = document.querySelector('#main > div._1_q7u').querySelector('div._1_vLz')
    let loader = findReactComponent(htmlLoader)
    loader.props.loadMoreMsgs();
}


/**
 * scroll Y pixels to top
 */
function scrollChatTop() {
    getHtmlElement('chat_history').lastChild.scrollTo(0, -Math.abs(rand(100, 2000)));
}

/**
 * scroll Y pixels to bottom
 */
function scrollChatBottom() {
    getHtmlElement('chat_history').lastChild.scrollTo(0, -Math.abs(rand(60000000, 70000000)));
}

// Get random value between a range
function rand(high, low = 0) {
    return Math.floor(Math.random() * (high - low + 1) + low);
}


async function loadMessagesUntilCondition(condition, maxTimeoutSeconds = 10) {
    if (typeof condition !== 'function')
        return new Promise.reject('condition must be an function')

    var timeout = 0;
    let promise = new Promise((resolve, reject) => {
        var interval = setInterval(() => {
            if (condition()) {
                clearInterval(interval);
                clearTimeout(timeout);
                scrollChatBottom();
                resolve(true);
            }
            scrollChatTop();
            //loadMoreMsgs();
        }, 500);
        timeout = setTimeout(() => {
            clearInterval(interval);
            scrollChatBottom();
            reject(`reach ${maxTimeoutSeconds} seconds timeout!`);
        }, maxTimeoutSeconds * 1000);
    });
    return promise;
}

/**
 * group creation notification show's when you reach the top of the group
 */
function reachGroupCreationNotification(msgs) {
    return msgs.find(e => e.type === "gp2" && e.subtype === "create" && e.isNotification)
}


async function readMessages() {
    let execInitialTimestamp = new Date();
    let controlFile = load(true)

    if (!controlFile.groups)
        controlFile.groups = getSourceGroups()

    let updatedGroupData = getChatsHtmlAndBasicInformation()

    let groupKeys = Object.keys(controlFile.groups)
    console.log(groupKeys)
    for (let index = 0; index < groupKeys.length; index++) {
        const key = groupKeys[index];
        let oldValue = controlFile.groups[key]
        let updatedValue = updatedGroupData[key]

        if (oldValue.lastMessage && oldValue.lastMessage.id === updatedValue.lastMessage.id)
            console.log(`Nothing new on: ${updatedValue.name} (gid ${key})`)
        else
            console.log(`New messages found on: ${updatedValue.name} (gid ${key})`)

        //fresh group
        let midnight = new Date(new Date().setHours(0, 0, 0, 0)).getTime() / 1000
        if (!controlFile.groups[key].lastMessage && updatedValue.minTimestamp > midnight) {
            console.log(`Fresh group detected, read daily messages ${updatedValue.name} (gid ${key})`)
            let selected = await selectChat(updatedValue.htmlElement)
            if (selected) {
                chatMsgsHtml = document.querySelector('div._1ays2')
                chatMsgsReact = findReactComponent(chatMsgsHtml);
                reachCondition = await loadMessagesUntilCondition(() => reachDate(chatMsgsReact.props.msgs, midnight) || reachGroupCreationNotification(chatMsgsReact.props.msgs))
                if (reachCondition)
                    updatedValue = cleanChatData(updatedValue.htmlElement)
            }
        }
        delete updatedValue['htmlElement']
        console.log(`Updating on control file: ${updatedValue.name} (gid ${key})`)
        controlFile.groups[key] = {
            ...oldValue,
            ...updatedValue,
            msgs: {
                ...oldValue.msgs,
                ...updatedValue.msgs,
            }
        }
    }

    let execFinalTimestamp = new Date();
    controlFile = {
        ...controlFile,
        controls: {
            execInitialTimestamp,
            execFinalTimestamp
        }
    }
    console.log(`Saving on localStorage`)
    save(controlFile)
}

function startSpammClassification() {
    let controlFile = load(true)
    let saveToPost = {}
    let flatMessages24h = {}
    let flatParticipants = {}

    //filter 24h messages only
    let yesterday = new Date().getTime() / 1000 - 24 * 60 * 60
    Object.keys(controlFile.groups).forEach(groupKey => {
        //flat participants
        Object.keys(controlFile.groups[groupKey].participants).forEach(participantKey => {
            if (!flatParticipants[participantKey])
                flatParticipants[participantKey] = controlFile.groups[groupKey].participants[participantKey]
        })

        //flat messages
        Object.keys(controlFile.groups[groupKey].msgs).forEach(msgKey => {
            if (controlFile.groups[groupKey].msgs[msgKey].t > yesterday) {
                flatMessages24h[msgKey] = controlFile.groups[groupKey].msgs[msgKey]
                flatMessages24h[msgKey].state = controlFile.groups[groupKey].state.abbrev
            }
        })
    })

    Object.entries(flatMessages24h).forEach(keyAndValue => {
        let messageKey = keyAndValue[0]
        let messageObject = keyAndValue[1]
        let currentId = messageKey
        let currentObject = messageObject

        //skip if id is marked as similar on previous string
        if (Object.entries(saveToPost).find(keyAndValue => keyAndValue.length && keyAndValue[1].jaroWrinker[currentId])) return

        if (!saveToPost[currentId]) {
            saveToPost[currentId] = currentObject
            saveToPost[currentId].jaroWrinker = {}
        }

        Object.entries(flatMessages24h).forEach(keyAndValue => {
            let messageKey = keyAndValue[0]
            let messageObject = keyAndValue[1]
            let jaroSimilarity = JaroWrinker(currentObject.text, messageObject.text)
            if (messageKey === currentId) return

            //save jaroSimilatiry on object
            if (currentObject.senderId === messageObject.senderId && jaroSimilarity > spammConfig.JaroWrinker.sameUser)
                saveToPost[currentId].jaroWrinker[messageKey] = jaroSimilarity
            if (currentObject.senderId !== messageObject.senderId && jaroSimilarity > spammConfig.JaroWrinker.differentUser)
                saveToPost[currentId].jaroWrinker[messageKey] = jaroSimilarity
        })
    })

    controlFile = {
        ...controlFile,
        last24hWithoutSpamm: {
            ...controlFile.last24hWithoutSpamm,
            ...saveToPost
        },
        last24hWithoutSpammLength: Object.keys(saveToPost).length,
        flatMessages24h: {
            ...controlFile.flatMessages24h,
            ...flatMessages24h
        },
        flatMessages24hLength: Object.keys(flatMessages24h).length,
        flatParticipants,
        flatParticipantsLength: Object.keys(flatParticipants).length
    }
    save(controlFile)
}


function GroupsByState(groupList) {
    return Object.entries(groupList).reduce((prev, curr) => {
        prev[curr[1].state.abbrev] ? prev[curr[1].state.abbrev].push(curr[1].id) : prev[curr[1].state.abbrev] = [curr[1].id]
        return prev
    }, {})
}

/** just wait :D */
function wait(time) {
    return new Promise(resolve => {
        let timeout = setTimeout(() => {
            resolve();
        }, time);
    });
}

/**
 * loop on messages
 * classify using wit.ai every 1.5sec
 */
async function sendMessages() {
    let controlFile = load(true)
    let msgsKey = Object.keys(controlFile.last24hWithoutSpamm).filter(msg => controlFile.last24hWithoutSpamm[msg].boldtext)
    if (!msgsKey.length) return false;

    let targetGroups = getTargetGroups()
    let groupsByState = GroupsByState(targetGroups)

    let updatedGroupData = getChatsHtmlAndBasicInformation()
    console.log(updatedGroupData)
    for (let index = 0; index < msgsKey.length; index++) {
        const key = msgsKey[index];
        let message = controlFile.last24hWithoutSpamm[key]
        let groupsToSend = groupsByState[message.state]

        for (const arrayIndex in groupsToSend) {
            console.log(`abrindo grupo ${groupsToSend[arrayIndex]} mensage: ${message.text}`)
            let html = updatedGroupData[groupsToSend[arrayIndex]].htmlElement
            let group = updatedGroupData[groupsToSend[arrayIndex]]
            console.log(group)

            //manipular o wit.ai aki
            //esperar o 1sec+ para proxima call
            let sent = await sendOneMessage(html, message.boldtext)

            if (sent) {
                await wait(400)
                console.log(`How we can confirm if was sent or not?`)
            }
            console.log(`mensage: ${message.text} sent:${sent}`)
            await wait(1500)
        }
    }
}


var witClassificationInterval = undefined

function requestWit(message) {
    let encodedMessage = encodeURIComponent(message)
    return fetch(`${witConfig.baseUrl}${encodedMessage}`, {
            method: 'get',
            headers: {
                'Authorization': `Bearer ${witConfig.token}`
            }
        })
        .then(response => response.json())
        .then(data => {
            // Here's a list of repos!
            return data
        });
}

/**
 * processa a fila para classificar as mensagens
 */
async function startWitClassification() {
    console.log(`startWitClassification`)
    if (witConfig.classificationInterval < 1.5)
        throw ('Wit classification interval must be 1.5 sec or more')


    witClassificationInterval = setInterval(async () => {
        console.log(`requesting...wit`)
        let controlFile = load(true)
        var {
            last24hWithoutSpamm
        } = controlFile
        let notProcessedWitKeys = Object.keys(last24hWithoutSpamm).filter(key => !last24hWithoutSpamm[key].wit)
        let firstKey = notProcessedWitKeys[0]
        let firstObject = last24hWithoutSpamm[firstKey]
        if (firstObject && firstObject.text) {
            let witResponse = await requestWit(firstObject.text)
            if (witResponse && witResponse.msg_id) {
                firstObject.wit = witResponse
                last24hWithoutSpamm[firstKey] = firstObject
                controlFile = {
                    ...controlFile,
                    last24hWithoutSpamm
                }
                save(controlFile)
            }
        }
    }, witConfig.classificationInterval * 1000);
    return witClassificationInterval
}


function stopWitClassification() {
    if (witClassificationInterval === undefined) {
        console.log(`Wit classification is not started handle: ${witClassificationInterval}`)
        return true
    }
    console.log(`Stopping wit classification handle: ${witClassificationInterval}`)
    clearInterval(witClassificationInterval)
    witClassificationInterval = undefined
    return true
}

//US numbers we format as national, others country is international format
//on exception return the input
function formatPhoneNumber(number) {
    return '+' + number.replace(/[^\d]/gmi, '')
}

//format phone number if exist
//or append senderId on boldtext
function addMessagePhoneNumber(object) {
    object.boldtext = object.text
    //phone number        
    if (!object.wit.entities.phone_number) {
        //no phone number on message
        let formattedPhoneNumber = formatPhoneNumber(object.senderId)
        let newline = '\n'
        object.boldtext = `${object.boldtext}${newline}*Contato: ${formattedPhoneNumber}*`
    } else {
        //varios phone number add *phone* on them
        object.wit.entities.phone_number.forEach(phone => {
            let number = phone.value
            let formattedPhoneNumber = formatPhoneNumber(number)
            object.boldtext = object.boldtext.replace(number, `*${formattedPhoneNumber}*`)
        })
    }
    return object
}

//add asterisk around entities
//skip intent and phone_number
function addBoldAroundEntities(object) {
    //others keys like location
    let restKeys = Object.keys(object.wit.entities).filter(key => key !== 'intent' && key !== 'phone_number')
    restKeys.forEach(key => {
        let entityOccurences = object.wit.entities[key]
        entityOccurences.forEach(occurence => {
            let value = occurence.value
            object.boldtext = object.boldtext.replace(value, `*${value}*`)
        })
    })
    return object
}

//add boldText on messages with intent
function boldMessagesBeforeSend() {
    let controlFile = load(true)
    var {
        last24hWithoutSpamm
    } = controlFile

    let processedOnWit = Object.keys(last24hWithoutSpamm).filter(key => last24hWithoutSpamm[key].wit && last24hWithoutSpamm[key].wit.entities && last24hWithoutSpamm[key].wit.entities.intent)
    processedOnWit.forEach(key => {
        let object = last24hWithoutSpamm[key]
        object.boldtext = object.text
        object = addMessagePhoneNumber(object)
        object = addBoldAroundEntities(object)
        last24hWithoutSpamm[key] = object
    })
    controlFile = {
        ...controlFile,
        last24hWithoutSpamm
    }
    save(controlFile)
    return last24hWithoutSpamm
}


async function sendOneMessage(chatHtml, message) {
    let selected = await selectChat(chatHtml)
    let promise = new Promise((resolve, reject) => {
        try {
            if (!selected)
                throw (`Chat not open!`)
            let messageBox = document.querySelectorAll("[contenteditable='true']")[0];
            messageBox.innerHTML = message.replace(/  /gm, '');
            let event = document.createEvent("UIEvents");
            event.initUIEvent("input", true, true, window, 1);
            messageBox.dispatchEvent(event);

            eventFire(document.querySelector('span[data-icon="send"]'), 'click');
            //how to confirm if is sent or not?
            resolve(true)
        } catch (error) {
            reject(error)
        }
    });
    return promise;
}

window.zapBot = {
    stopWitClassification,
    startWitClassification,
    startSpammClassification,
    sendMessages,
    readMessages,
    boldMessagesBeforeSend
}
/**
 * we read the messages
 * spammclassification
 * witclassification
 * boldMessages
 * sendMessages to our users
 */