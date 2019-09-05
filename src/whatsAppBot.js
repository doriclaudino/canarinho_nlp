//
// GLOBAL VARS AND CONFIGS
//
var MSG_POSITION = {
    FRONT: "FRONT",
    MID: "MID",
    END: "END",
    SINGLE: "SINGLE"
}

var userRequestStopError = 'user type console.stop()'
var consoleOpenLevel = 0;
var stopRequested = false;
var NEW_GROUP_MAX_TIMEOUT_SEC = 120;
var GROUP_MAX_TIMEOUT_SEC = 20;

var lastMessageOnChat = false;
var intervals = {};
var timeouts = {};
var promises = {};
var cancelAllPendingAsync = false;
var ignoreLastMsg = {};
var elementConfig = {
    "chats": [0, 0, 5, 2, 0, 3, 0, 0, 0],
    "chat_icons": [0, 0, 1, 1, 1, 0],
    "chat_title": [0, 0, 1, 0, 0, 0, 0],
    "chat_lastmsg": [0, 0, 1, 1, 0, 0],
    "chat_lasttime": [0, 0, 1, 0, 1],
    "chat_active": [0, 0],
    "selected_title": [0, 0, 5, 3, 0, 1, 1, 0, 0, 0],
    "group_users": [0, 0, 5, 3, 0, 1, 1, 1, 0],
    "chat_history": [0, 0, 5, 3, 0, 4, 0],
};
var unreadThreshold = 5; //5 chats unread, loop start again
var minLoopInterval = rand(120, 60) * 1000; //between 1-2min
var groupLastReadTimestamp = {}
var scrollSpeedConfig = {
    'robot': {
        min: 50,
        max: 100,
        length: 3000
    },
    'fast': {
        min: 200,
        max: 400,
        length: 500
    },
    'normal': {
        min: 1000,
        max: 2000,
        length: 300
    },
    'slow': {
        min: 2000,
        max: 3000,
        length: 100
    }
}
var scrollSpeed = 'fast';
var chatReadControl = []
var key = 'whatsAppBotData'


//
// FUNCTIONS
//

// Get random value between a range
function rand(high, low = 0) {
    return Math.floor(Math.random() * (high - low + 1) + low);
}

function getElement(id, parent) {
    if (!elementConfig[id]) {
        return false;
    }
    var elem = !parent ? document.body : parent;
    var elementArr = elementConfig[id];
    elementArr.forEach(function (pos) {
        if (!elem.childNodes[pos]) {
            return false;
        }
        elem = elem.childNodes[pos];
    });
    return elem;
}

// Call the main function again
function goAgain(fn, sec) {
    timeout = setTimeout(fn, sec * 1000)
    timeouts['goAgain'] = timeout
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
        promises['selectChat'] = reject
        var interval = setInterval(() => {            
            count++;
            const titleMain = getElement("selected_title").title;

            if (titleMain) {
                clearInterval(interval);
                resolve(titleMain === title)
            } else if (count > 20) {
                clearInterval(interval);
                reject('selectChat - maximum 20 times reached')
            }
        }, 300);
        intervals['selectChat'] = interval;
    });    
    return promise;
}


/**
 * scroll Y pixels to top
 */
function scrollChatTop() {
    getElement('chat_history').lastChild.scrollTo(0, -Math.abs(rand(100, 2000)));
}

/**
 * scroll Y pixels to bottom
 */
function scrollChatBottom() {
    getElement('chat_history').lastChild.scrollTo(0, -Math.abs(rand(60000000, 70000000)));
}

/** just wait :D */
function wait(time) {
    return new Promise(resolve => {
        timeout = setTimeout(() => {
            resolve();
        }, time);
        timeouts['wait'] = timeout
    });
}

/**
 * clean when dev
 */
function cleanLocalStorage() {
    return localStorage.removeItem(key)
}

function save(data) {
    return localStorage.setItem(key, JSON.stringify(data))
}

function load(parse = true) {
    if (parse)
        return JSON.parse(localStorage.getItem(key)) || {}
    else
        return localStorage.getItem(key)
}

function getMaxDate(datesArray) {
    return new Date(Math.max.apply(null, datesArray));
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

var htmlElements = {
    "chatList": {
        id: 'pane-side',
        path: [0, 0]
    }
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

/**
 * select usefull chat data
 */
function cleanChatData(raw) {
    let last = raw.msgs._last;
    return {
        name: raw.name,
        id: raw.id.user,
        hasUnread: raw.hasUnread,
        unreadCount: raw.unreadCount,
        msgs: raw.msgs,
        loadedMessages: Object.keys(raw.msgs._index).length,
        lastMessage: last ? {
            text: last.text,
            timestamp: last.t,
            id: last.id.id,
            sender: {
                ...formatSender(last)
            },
        } : undefined,
        createdAt: raw.groupMetadata.creation,
        users: Object.keys(raw.groupMetadata.participants._index).length
    }
}

/**
 * get elements from html chat list
 */
function getHtmlChatItems() {
    let html = getHtmlElement('chatList')
    let total = html.childNodes[0].childElementCount

    let reactElements = {}
    for (let index = 0; index < total; index++) {
        let htmlElement = html.childNodes[0].childNodes[index];
        let reactComponent = findReactComponent(htmlElement);
        if (!reactComponent || !reactComponent.props || !reactComponent.props.data || !reactComponent.props.data.data || !reactComponent.props.data.data.isGroup) continue;
        let rawData = reactComponent.props.data.data
        let cleanedData = cleanChatData(rawData)

        cleanedData['htmlElement'] = htmlElement
        reactElements[cleanedData.id] = cleanedData
    }
    return reactElements
}

/**
 * delete recursive data
 */
function cleanAndSave(data) {
    for (const key in data) {
        if (data.hasOwnProperty(key)) {
            delete data[key]['htmlElement'];
            delete data[key]['msgs'];
        }
    }
    save(data);
}

/**
 * 
 * @param {*} data 
 * @param {*} filename 
 */
function exportLocalFile(data, filename) {
    if (!data) {
        console.error('exportLocalFile - no data')
        return;
    }

    if (!filename) {
        console.error('exportLocalFile - no filename')
        return;
    }


    if (typeof data === "object") {
        data = JSON.stringify(data, undefined, 4)
    }

    var blob = new Blob([data], {
            type: 'text/json'
        }),
        e = document.createEvent('MouseEvents'),
        a = document.createElement('a')

    a.download = filename
    a.href = window.URL.createObjectURL(blob)
    a.dataset.downloadurl = ['text/json', a.download, a.href].join(':')
    e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null)
    a.dispatchEvent(e)
    timeout = setTimeout(() => {
        document.removeChild(a);
    }, 1000);
    timeouts['exportLocalFile'] = timeout
}


console.stop = function () {
    stopRequested = true;
    clearAllIntervals();
    clearAllTimeouts();
    rejectAllPromises();
    for (let index = 0; index < consoleOpenLevel; index++) {
        console.groupEnd();
    }
    stopRequested = false;
    return true;
}

function clearAllIntervals() {
    for (const key in intervals) {
        if (intervals.hasOwnProperty(key)) {
            clearInterval(intervals[key]);
        }
    }
}

function clearAllTimeouts() {
    for (const key in timeouts) {
        if (timeouts.hasOwnProperty(key)) {
            clearTimeout(timeouts[key]);
        }
    }
}

function rejectAllPromises() {
    for (const key in promises) {
        if (promises.hasOwnProperty(key)) {
            reject = promises[key]
            reject(userRequestStopError);
        }
    }
}

/**
 * format the sender object
 * we can memoize it on future
 */
function formatSender(obj) {
    if (!obj || obj.sender === undefined)
        return undefined
    return {
        id: obj.sender ? obj.sender.user : undefined,
        displayName: obj.senderObj ? obj.senderObj.displayName : undefined,
        formattedName: obj.senderObj ? obj.senderObj.formattedName : undefined,
        formattedUser: obj.senderObj ? obj.senderObj.formattedUser : undefined,
    }
}

/**
 * add milliseconds to an date, we need?
 */
function createDate(timestamp) {
    return timestamp * 1000
}

/**
 * e2e notification show's when you reach the top of the group
 */
function reachEncryptNotification(msgs) {
    return msgs.find(e => e.type === "e2e_notification" && e.subtype === "encrypt" && e.isNotification)
}

/**
 * group creation notification show's when you reach the top of the group
 */
function reachGroupCreationNotification(msgs) {
    return msgs.find(e => e.type === "gp2" && e.subtype === "create" && e.isNotification)
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
 * scroll to top/bottom, to clean the badges of unreaded msgs
 * loadMoreMsgs() will load directly to us
 */
async function loadMessagesUntilCondition(condition, maxTimeoutSeconds = 10 * 1000) {
    if (typeof condition !== 'function')
        return new Promise.reject('condition must be an function')

    var timeout = 0;
    let promise = new Promise((resolve, reject) => {
        promises['loadMessagesUntilCondition'] = reject
        var interval = setInterval(() => {            
            if (condition()) {
                clearInterval(interval);
                clearTimeout(timeout);
                scrollChatBottom();
                resolve(true);
            }
            scrollChatTop();
            loadMoreMsgs();
        }, 500);
        intervals['loadMessagesUntilCondition'] = interval;
        timeout = setTimeout(() => {
            clearInterval(interval);
            scrollChatBottom();
            reject(`reach ${maxTimeoutSeconds} seconds timeout!`);
        }, maxTimeoutSeconds * 1000);
        timeouts['loadMessagesUntilCondition'] = interval;
    });
    return promise;
}

/** not exist on database or lastMessageId not match */
async function start() {
    console.warn(`run console.stop() to stop all processes`)
    //cleanLocalStorage(); //clean when dev
    chatItems = getHtmlChatItems()
    oldGroupExecution = load();
    senders = oldGroupExecution['senders'] || {}
    unreadsByMessageId = Object.keys(chatItems)
        .filter(e => (oldGroupExecution[e] && !oldGroupExecution[e].reachTopOnce) || oldGroupExecution[e] === undefined || oldGroupExecution[e].lastMessage.id !== chatItems[e].lastMessage.id)
    console.group(unreadsByMessageId.length ? `Found ${unreadsByMessageId.length} unread group(s) 😕 ${new Date}` : `Nothing to read 😍 ${new Date}`);
    consoleOpenLevel = 1;
    /**
     * run in every unread chat
     */
    for (const key in unreadsByMessageId) {
        if (unreadsByMessageId.hasOwnProperty(key)) {
            const chatId = unreadsByMessageId[key];
            const unreadChatGroup = chatItems[chatId];
            const oldExecutionRef = oldGroupExecution[chatId]

            const selectedChat = await selectChat(unreadChatGroup.htmlElement)
            if (!selectedChat) continue;

            startDate = new Date()
            console.group(`group ${chatId} - ${unreadChatGroup.name}`);
            consoleOpenLevel = 2;
            console.log(`- start at ${startDate}`)

            lastExecution = {
                timestamp: new Date().getTime()
            }
            chatMsgsHtml = document.querySelector('div._1ays2')
            chatMsgsReact = findReactComponent(chatMsgsHtml);
            reachTopOnce = (oldExecutionRef !== undefined && oldExecutionRef['reachTopOnce'] === true);

            //new group or never reach the top
            try {
                if (!reachTopOnce) {
                    console.log(`- new group or never reach the top`)
                    result = await loadMessagesUntilCondition(() => {
                        return reachEncryptNotification(unreadChatGroup.msgs._models)
                    }, NEW_GROUP_MAX_TIMEOUT_SEC);
                    reachTopOnce = true;
                } else {
                    console.log(`- lastExecution at ${new Date(oldExecutionRef.lastExecution.timestamp)}`)
                    await loadMessagesUntilCondition(() => {
                        return (reachDate(unreadChatGroup.msgs._models, createDate(oldExecutionRef.lastMessageReaded.timestamp)) || reachEncryptNotification(unreadChatGroup.msgs._models))
                    }, GROUP_MAX_TIMEOUT_SEC)
                }
            } catch (error) {
                if(error === userRequestStopError)
                    return;
                console.log(`- error ${error}`)
                lastExecution.sucess = false
                lastExecution.error = error
            }

            lastAndFirstCursor = Array.from(unreadChatGroup.msgs._models).reduce((prev, curr) => {
                if (prev.last.t < curr.t || prev.last.t === undefined) prev.last = curr;
                if (prev.first.t > curr.t || prev.first.t === undefined) prev.first = curr;
                return prev
            }, {
                last: {
                    t: undefined
                },
                first: {
                    t: undefined
                }
            })

            if (lastAndFirstCursor) {
                var {
                    first,
                    last
                } = lastAndFirstCursor
                lastMessageReaded = {
                    text: lastAndFirstCursor.last.text,
                    timestamp: last.t,
                    id: last.id.id,
                    sender: {
                        ...formatSender(last)
                    },
                }
                firstMessageReaded = {
                    text: first.text,
                    timestamp: first.t,
                    id: first.id.id,
                    subtype: last.subtype,
                    type: last.type,
                    sender: {
                        ...formatSender(first)
                    },
                }
            } else {
                lastAndFirstCursor = undefined
                firstMessageReaded = undefined
            }

            msgsReaded = unreadChatGroup.msgs._models.length
            totalMsgsReaded = unreadChatGroup.totalMsgsReaded !== undefined ? unreadChatGroup.totalMsgsReaded + totalMsgsReaded : msgsReaded

            msgs = {}

            //loop html chat lines
            //because we can't figureout top/mid/end singles messages styles by reactProps
            parentMsgsId = undefined;
            enterKey = '\u23CE'; //ENTER KEY
            if (!chatMsgsHtml.hasChildNodes()) return;
            Array.from(chatMsgsHtml.children).forEach(line => {
                reactLine = findReactComponent(line)
                if (!reactLine) return;

                rawMsg = reactLine.props.msg

                /** we save the first id when starting multiline msg */
                if (reactLine.props.position === MSG_POSITION.FRONT)
                    parentMsgsId = rawMsg.id.id;
                else if (reactLine.props.position === MSG_POSITION.SINGLE)
                    parentMsgsId = undefined;

                sender = {
                    ...formatSender(rawMsg)
                }

                //skip if: not an text, sender from system
                if (rawMsg._ProxyState$state.text === undefined || sender.id === undefined)
                    return;

                //updte sender
                senders[sender.id] = {
                    displayName: sender.displayName,
                    formattedName: sender.formattedName,
                    formattedUser: sender.formattedUser,
                }

                //append
                if (parentMsgsId !== undefined) {
                    text = rawMsg._ProxyState$state.text
                    msgs[parentMsgsId] = {
                        senderId: sender.id,
                        text: msgs[parentMsgsId] === undefined ? text : msgs[parentMsgsId].text + enterKey + text, //save and appens multines
                        timestamp: rawMsg._ProxyState$state.t,
                    }
                } else {
                    //MSG_POSITION.SINGLE
                    msgs[rawMsg.id.id] = {
                        senderId: sender.id,
                        text: rawMsg._ProxyState$state.text,
                        timestamp: rawMsg._ProxyState$state.t,
                    }
                }
            });

            appendMsgs = oldExecutionRef === undefined ? {
                ...msgs,
            } : {
                ...msgs,
                ...oldExecutionRef.msgs
            }

            msgsLength = Object.keys(appendMsgs).length;

            console.log(`- total msgs readed ${totalMsgsReaded}`)
            console.log(`- total msgs stored ${msgsLength}`)

            endDate = new Date();
            duration = endDate - startDate
            lastExecution.duration = duration
            toSaveObject = {
                ...unreadChatGroup,
                msgsReaded,
                msgs: appendMsgs,
                msgsLength,
                totalMsgsReaded,
                lastMessageReaded,
                firstMessageReaded,
                lastExecution,
                reachTopOnce
            }
            console.log(`- saving control file on LocalStorageAPI`)
            oldGroupExecution[chatId] = toSaveObject
            oldGroupExecution['senders'] = senders;
            console.log(oldGroupExecution[chatId])

            /**
             * delete htmlElement and msgs
             * msgs will be exported at the end
             */
            cleanAndSave(oldGroupExecution);

            console.log(`- duration ${duration/1000}sec (${duration} ms)`)
            console.log(`- end at ${endDate}`)
            console.groupEnd();
            consoleOpenLevel = 1;
            await wait(500)
        }
    }

    filename = `export_${key}.json`
    exportLocalFile(JSON.stringify(oldGroupExecution), filename)
    console.groupEnd();
    consoleOpenLevel = 0;
}

start();


/**
 * need refactoring:
 * 
 * 
 * * memoize strings with id: one string could have more than one id because is more like will repeatly strings
 *  "hello how are you?" : [ids...,ids...]
 * 
 * 
 */