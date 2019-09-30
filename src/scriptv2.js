JaroWrinker = function (s1, s2) {
    var m = 0;

    // Exit early if either are empty.
    if (s1.length === 0 || s2.length === 0) {
        return 0;
    }

    // Exit early if they're an exact match.
    if (s1 === s2) {
        return 1;
    }

    var range = (Math.floor(Math.max(s1.length, s2.length) / 2)) - 1,
        s1Matches = new Array(s1.length),
        s2Matches = new Array(s2.length);

    for (i = 0; i < s1.length; i++) {
        var low = (i >= range) ? i - range : 0,
            high = (i + range <= s2.length) ? (i + range) : (s2.length - 1);

        for (j = low; j <= high; j++) {
            if (s1Matches[i] !== true && s2Matches[j] !== true && s1[i] === s2[j]) {
                ++m;
                s1Matches[i] = s2Matches[j] = true;
                break;
            }
        }
    }

    // Exit early if no matches were found.
    if (m === 0) {
        return 0;
    }

    // Count the transpositions.
    var k = n_trans = 0;

    for (i = 0; i < s1.length; i++) {
        if (s1Matches[i] === true) {
            for (j = k; j < s2.length; j++) {
                if (s2Matches[j] === true) {
                    k = j + 1;
                    break;
                }
            }

            if (s1[i] !== s2[j]) {
                ++n_trans;
            }
        }
    }

    var weight = (m / s1.length + m / s2.length + (m - (n_trans / 2)) / m) / 3,
        l = 0,
        p = 0.1;

    if (weight > 0.7) {
        while (s1[l] === s2[l] && l < 4) {
            ++l;
        }

        weight = weight + l * p * (1 - weight);
    }

    return weight;
}


var unitedStates = {
    'MA': {
        abbrev: 'MA',
        name: 'Massachusetts'
    }
}

var STORAGE_BOT_KEY = 'zap_bot_key'

var htmlElements = {
    "chatList": {
        id: 'pane-side',
        path: [0, 0]
    },
    "selected_title": {
        path: [0, 0, 5, 3, 0, 1, 1, 0, 0, 0]
    },
    "chat_history": {
        path: [0, 0, 5, 3, 0, 4, 0]
    },
}


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

    data = reactComponent.props.data.data || null
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
        cleanedData = cleanChatData(htmlElement)
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
    participants = {}
    participantsLength = 0
    Object.entries(raw.groupMetadata.participants._index).map(keyAndValue => {
        key = keyAndValue[0]
        value = keyAndValue[1]
        participants[value.id.user] = cleanParticipantData(value)
        participantsLength++
    })

    msgs = {}
    msgLength = 0
    minTimestamp = Infinity
    maxTimestamp = 0 //should be equals to the lastMessage
    Object.entries(raw.msgs._index).map(keyAndValue => {
        key = keyAndValue[0]
        value = keyAndValue[1]
        cleanedMsgData = cleanMsgData(value)

        minTimestamp = Math.min(minTimestamp, cleanedMsgData.t)
        maxTimestamp = Math.max(maxTimestamp, cleanedMsgData.t)

        //not a chat? we skip
        if (cleanedMsgData.type !== 'chat') return false

        delete cleanedMsgData['type']
        tempText = removeDoubleSpaces(cleanedMsgData.text)

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
    return localStorage.removeItem(STORAGE_BOT_KEY)
}

function save(data) {
    return localStorage.setItem(STORAGE_BOT_KEY, JSON.stringify(data))
}

function load(parse = true) {
    if (parse)
        return JSON.parse(localStorage.getItem(STORAGE_BOT_KEY)) || {}
    else
        return localStorage.getItem(STORAGE_BOT_KEY)
}

//groups to read information
function getSourceGroups() {
    return {
        "18572617562-1462832605": {
            state: unitedStates.MA,
            id: "18572617562-1462832605",
        },
        "17023664243-1569864372": {
            state: unitedStates.MA,
            id: "17023664243-1569864372",
        },
        "17023664243-1569864169": {
            state: unitedStates.MA,
            id: "17023664243-1569864169",
        }
    }
}

//groups to reshare
function getTargetGroups() {
    return {
        "17023664243-1569864463": {
            state: unitedStates.MA,
            id: "17023664243-1569864463",
        },
        "17023664243-1569864482": {
            state: unitedStates.MA,
            id: "17023664243-1569864482",
        }
    }
}

function reachDate(msgs, desiredTimestamp) {
    return msgs.find(e => e.t < desiredTimestamp)
}

function loadMoreMsgs() {
    htmlLoader = document.querySelector('#main > div._1_q7u').querySelector('div._1_vLz')
    loader = findReactComponent(htmlLoader)
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


async function start() {
    execInitialTimestamp = new Date();
    let controlFile = load(true)

    if (!controlFile.groups)
        controlFile.groups = getSourceGroups()

    updatedGroupData = getChatsHtmlAndBasicInformation()

    groupKeys = Object.keys(controlFile.groups)
    console.log(groupKeys)
    for (let index = 0; index < groupKeys.length; index++) {
        const key = groupKeys[index];
        oldValue = controlFile.groups[key]
        updatedValue = updatedGroupData[key]

        if (oldValue.lastMessage && oldValue.lastMessage.id === updatedValue.lastMessage.id)
            console.log(`Nothing new on: ${updatedValue.name} (gid ${key})`)
        else
            console.log(`New messages found on: ${updatedValue.name} (gid ${key})`)

        //fresh group
        midnight = new Date(new Date().setHours(0, 0, 0, 0)).getTime() / 1000
        if (!controlFile.groups[key].lastMessage && updatedValue.minTimestamp > midnight) {
            console.log(`Fresh group detected, read daily messages ${updatedValue.name} (gid ${key})`)
            selected = await selectChat(updatedValue.htmlElement)
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

    execFinalTimestamp = new Date();
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

function comparePhraseDistance() {
    rules = {
        sameUser: {
            JaroWrinker: .80
        },
        differentUser: {
            JaroWrinker: .90
        }
    }

    controlFile = load(true)
    saveToPost = {}
    flatMessages = {}
    flatParticipants = {}

    //filter 24h messages only
    yesterday = new Date().getTime() / 1000 - 24 * 60 * 60
    Object.keys(controlFile.groups).forEach(groupKey => {
        //flat participants
        Object.keys(controlFile.groups[groupKey].participants).forEach(participantKey => {
            if (!flatParticipants[participantKey])
                flatParticipants[participantKey] = controlFile.groups[groupKey].participants[participantKey]
        })

        //flat messages
        Object.keys(controlFile.groups[groupKey].msgs).forEach(msgKey => {
            if (controlFile.groups[groupKey].msgs[msgKey].t > yesterday)
                flatMessages[msgKey] = controlFile.groups[groupKey].msgs[msgKey]
        })
    })

    Object.entries(flatMessages).forEach(keyAndValue => {
        messageKey = keyAndValue[0]
        messageObject = keyAndValue[1]
        currentId = messageKey
        currentObject = messageObject

        //skip if id is marked as similar on previous string
        if (Object.entries(saveToPost).find(keyAndValue => keyAndValue.length && keyAndValue[1].jaroWrinker[currentId])) return

        if (!saveToPost[currentId]) {
            saveToPost[currentId] = currentObject
            saveToPost[currentId].jaroWrinker = {}
        }

        Object.entries(flatMessages).forEach(keyAndValue => {
            messageKey = keyAndValue[0]
            messageObject = keyAndValue[1]
            jaroSimilarity = JaroWrinker(currentObject.text, messageObject.text)
            if (messageKey === currentId) return

            //save jaroSimilatiry on object
            if (currentObject.senderId === messageObject.senderId && jaroSimilarity > rules.sameUser.JaroWrinker)
                saveToPost[currentId].jaroWrinker[messageKey] = jaroSimilarity
            if (currentObject.senderId !== messageObject.senderId && jaroSimilarity > rules.differentUser.JaroWrinker)
                saveToPost[currentId].jaroWrinker[messageKey] = jaroSimilarity
        })

    })

    controlFile = {
        ...controlFile,
        last24hWithoutSpamm: saveToPost,
        last24hWithoutSpammLength: Object.keys(saveToPost).length,
        flat24hMessages: flatMessages,
        flat24hMessagesLength: Object.keys(flatMessages).length,
        flatParticipants: flatParticipants,
        flatParticipantsLength: Object.keys(flatParticipants).length
    }
    save(controlFile)
}