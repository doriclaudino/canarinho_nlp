//
// GLOBAL VARS AND CONFIGS
//
var lastMessageOnChat = false;
var intervals = [];
var timeouts = [];
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

function getLastMsg() {
    var messages = document.querySelectorAll('.msg');
    var pos = messages.length - 1;

    while (messages[pos] && (messages[pos].classList.contains('msg-system') || messages[pos].querySelector('.message-in'))) {
        pos--;
        if (pos <= -1) {
            return false;
        }
    }
    if (messages[pos] && messages[pos].querySelector('.selectable-text')) {
        return messages[pos].querySelector('.selectable-text').innerText.trim();
    } else {
        return false;
    }
}

function getAllChats() {
    var chats = getElement("chats");
    var chatList = []
    if (chats) {
        chats = chats.childNodes;
        for (var i in chats) {
            if (!(chats[i] instanceof Element)) {
                continue;
            }
            const chat = chats[i]
            const title = chat.querySelector('span[dir="auto"]').title;
            const message = getElement("chat_lastmsg", chat).innerText;
            const timestamp = getElement("chat_lasttime", chat).innerText;
            const htmlElement = chat;
            chatList.push({
                title,
                message,
                timestamp,
                htmlElement
            });
        }
    }
    return chatList;
}

function getUnreadChats() {
    var unreadchats = [];
    var chats = getElement("chats");
    if (chats) {
        chats = chats.childNodes;
        for (var i in chats) {
            if (!(chats[i] instanceof Element)) {
                continue;
            }
            var icons = getElement("chat_icons", chats[i]).childNodes;
            if (!icons) {
                continue;
            }
            for (var j in icons) {
                if (icons[j] instanceof Element) {
                    if (!(icons[j].childNodes[0].getAttribute('data-icon') == 'muted' || icons[j].childNodes[0].getAttribute('data-icon') == 'pinned')) {
                        unreadchats.push(chats[i]);
                        break;
                    }
                }
            }
        }
    }
    return unreadchats;
}

function didYouSendLastMsg() {
    var messages = document.querySelectorAll('.msg');
    if (messages.length <= 0) {
        return false;
    }
    var pos = messages.length - 1;

    while (messages[pos] && messages[pos].classList.contains('msg-system')) {
        pos--;
        if (pos <= -1) {
            return -1;
        }
    }
    if (messages[pos].querySelector('.message-out')) {
        return true;
    }
    return false;
}

// Call the main function again
function goAgain(fn, sec) {
    setTimeout(fn, sec * 1000)
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
    eventFire(chat.firstChild.firstChild, 'mousedown');
    var count = 0;
    let promise = new Promise((resolve, reject) => {
        var interval = setInterval(() => {
            count++;
            console.log('selectChat loop ', count);
            const titleMain = getElement("selected_title").title;
            console.log(`title=${title} compared to ${titleMain}`);

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

// Send a message
function sendMessage(chat, message, cb) {
    //avoid duplicate sending
    var title;

    if (chat) {
        title = getElement("chat_title", chat).title;
    } else {
        title = getElement("selected_title").title;
    }
    ignoreLastMsg[title] = message;

    messageBox = document.querySelectorAll("[contenteditable='true']")[0];

    //add text into input field
    messageBox.innerHTML = message.replace(/  /gm, '');

    //Force refresh
    event = document.createEvent("UIEvents");
    event.initUIEvent("input", true, true, window, 1);
    messageBox.dispatchEvent(event);

    //Click at Send Button
    eventFire(document.querySelector('span[data-icon="send"]'), 'click');

    cb();
}


/**
 * chatContainer must be loaded
 * must have 10 users on group
 */
async function isAnValidChatGroup(title) {
    var count = 0;
    let promise = new Promise((resolve, reject) => {
        var interval = setInterval(() => {
            count++;

            var groupUsers = getElement("group_users").title;
            console.log(`isAnValidChatGroup title=${title} groupUsers=${groupUsers}`);

            //not loaded yet
            if (groupUsers === 'click here for group info')
                return;

            if (groupUsers || groupUsers === '' || groupUsers === undefined) {
                clearInterval(interval);
                resolve(/(?:.{10,25}\,){10,}/gmi.test(groupUsers))
            } else if (count > 20) {
                clearInterval(interval);
                reject('isAnValidChatGroup - maximum 20 times reached')
            }
        }, 300);
    });
    return promise;
}

/**
 * tells us when reach the top
 */
function reachTop() {
    var chat_history = getElement("chat_history");
    var foundAdded = true;
    var foundSecured = false;
    Array.from(chat_history.lastChild.lastChild.children).forEach(e => {
        element = e.querySelector('span[dir="ltr"]:last-child[class=""]');
        if (element) {
            if (!foundSecured && element.innerText.indexOf("you send to this group are secured with end-to-end encryption") > -1)
                foundSecured = true;
            if (!foundAdded && element.innerText.indexOf("added you") > -1)
                foundAdded = true;
        }
    });
    return foundAdded && foundSecured
}


/**
 * return an random min and max delay
 */
function getScrollDelay() {
    let config = getScrollConfig();
    return rand(config.min, config.max)
}

/**
 * get config and set scroll to negative
 */
function getScrollLength() {
    let config = getScrollConfig();
    return -Math.abs(config.length);
}

/**
 * get the user config otherwise use the normal speed
 */
function getScrollConfig() {
    return scrollSpeedConfig[scrollSpeed] || scrollSpeedConfig['normal']
}


/**
 * tells us when reach the top of chatHistory
 */
async function asyncLoadAllChatHistory() {
    cancelAllPendingAsync = false;
    speed = scrollSpeedConfig[scrollSpeed] || scrollSpeedConfig['normal']

    if (reachTop())
        return new Promise.resolve(true);

    let promise = new Promise((resolve, reject) => {
        var interval = setInterval(() => {
            if (cancelAllPendingAsync) {
                reject('User ask to CANCEL all pending async process')
            }
            if (reachTop()) {
                clearInterval(interval);
                resolve(true);
            }
            scrollChatTop();
        }, getScrollDelay());
        intervals.push(interval);
    });
    return promise;
}

/**
 * scroll Y pixels to top
 */
function scrollChatTop() {
    getElement('chat_history').lastChild.scrollTo(0, getScrollLength());
}

/**
 * all income messages on chathistory
 */
function getAllMessagesIn() {
    return Array.from(getElement("chat_history").lastChild.lastChild.children)
        .filter(e => e.querySelector('div.message-in'))
}


/**
 * 
 * @param {htmlElement} htmlElement 
 * extract innerText if element exist
 */
function getInnerText(htmlElement) {
    if (!htmlElement)
        return undefined
    return htmlElement.innerText
}

/**
 * 
 * @param {htmlElement} htmlElement 
 * pass the line element on chatHistory to extract the timestamp
 * if there's no timestamp means is not an text
 */
function getTimestamp(htmlElement) {
    if (!htmlElement)
        return undefined

    let rawTimestap = htmlElement.querySelector('div.copyable-text')
    if (!rawTimestap)
        return undefined
    rawTimestap = rawTimestap.getAttribute('data-pre-plain-text');

    if (!rawTimestap)
        return undefined
    const regex = /\[(\d{1,2})\:(\d{1,2})\s(.{2})..(\d{1,2})\/(\d{1,2})\/(\d{1,4})\]/gmi;
    const match = regex.exec(rawTimestap)
    const timestamp = new Date(match[6], match[4] - 1, match[5], match[3] === 'PM' ? parseInt(match[1]) + 12 : match[1], match[2], 0, 0);
    return timestamp.getTime()
}


/**
 * read all elements on chat history
 * try to merge multi-line screens
 */
function readCurrentChat() {
    lines = [];
    getAllMessagesIn().forEach((linha, index) => {
        line = linha
        header = undefined;
        messages = [];
        author = undefined;
        contact = undefined;
        text = undefined;
        timestamp = undefined;

        header = linha.querySelector('span.tail-container.highlight')
        if (header) {
            author = getInnerText(linha.querySelector('span._1F9Ap[dir="auto"]')) || getInnerText(linha.querySelector('span._1uQFN[dir="auto"]'))
            contact = getInnerText(linha.querySelector('span.ZObjg[role="button"]')) //name from others people contact       
        }

        timestamp = getTimestamp(linha)
        text = getInnerText(linha.querySelector('span.selectable-text.invisible-space.copyable-text'))

        if (!timestamp || !text)
            return;

        //create new
        if (header) {
            messages = [];
            messages.push({
                text,
                timestamp
            })
            lines.push({
                author,
                contact,
                timestamp,
                messages
            })
        } else if (lines.length) {
            //append last to the last one
            messages = lines[lines.length - 1].messages
            messages.push({
                text,
                timestamp
            })
            lines[lines.length - 1].messages = messages
        }
    })
    return lines;
}

function cancelAllPendingAsyncProcess() {
    cancelAllPendingAsync = true;
    timeouts.forEach(id => clearTimeout(id));
    intervals.forEach(id => clearInterval(id));
}


function wait(time) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve();
        }, time);
    });
}


/**
 * 
 * @param {*} date_to_search 
 */
function reachDate(date_to_search) {
    if (!date_to_search || !date_to_search.getTime())
        return false

    targetDate = date_to_search.getTime();
    var found = false;
    var chatList = readCurrentChat();
    found = chatList.findIndex(e => e.timestamp < targetDate) > -1 ? true : false;
    console.log(`found :${found}`)
    return found;
}

/**
 * 
 * @param {scroll until reach the function condition} condition 
 */
async function scrollToCondition(condition, maxTimeoutSeconds = 10 * 1000) {
    if (typeof condition !== 'function')
        return new Promise.reject('condition must be an function')

    speed = scrollSpeedConfig[scrollSpeed] || scrollSpeedConfig['normal']
    var timeout = 0;
    let promise = new Promise((resolve, reject) => {
        var interval = setInterval(() => {
            if (condition()) {
                clearInterval(interval);
                clearTimeout(timeout);
                resolve(true);
            }
            scrollChatTop();
        }, getScrollDelay());

        timeout = setTimeout(() => {
            clearInterval(interval);
            reject(`reach ${maxTimeoutSeconds} seconds timeout!`);
        }, maxTimeoutSeconds * 1000);
    });
    return promise;
}

function save(data) {
    return localStorage.setItem(key, JSON.stringify(data))
}

function load() {
    return JSON.parse(localStorage.getItem(key)) || {}
}

function getMaxDate(datesArray) {
    return new Date(Math.max.apply(null, datesArray));
}

/**
 * main loop will compare wich chat is missing to read
 * check if open the correct chat and load
 * check if got 10 users on group
 * 
 */
async function loop() {
    var chats = getAllChats() || [];
    var unMatchChats = chats; //.filter(chat => !chatReadControl.find(controlledChat => controlledChat.title === chat.title && controlledChat.message === chat.message && controlledChat.timestamp === chat.timestamp)) || [];
    var db = load();

    if (!db.groups)
        db['groups'] = {}

    groups = db.groups;
    save(db);
    for (let index = 0; index < unMatchChats.length; index++) {
        const unMatchChat = unMatchChats[index];
        selected = await selectChat(unMatchChat.htmlElement);
        valid = await isAnValidChatGroup(unMatchChat.title);
        if (!valid)
            continue;

        let isNewGroup = false;

        if (!groups[unMatchChat.title]) {
            unMatchChat['messages'] = [];
            groups[unMatchChat.title] = unMatchChat
            isNewGroup = true;
        }

        let memGroup = groups[unMatchChat.title]

        let condition;
        let lastExecutionTmp = new Date().getTime()
        let maxDate;
        if (!isNewGroup) {
            let oldMessagesDates = memGroup['messages'].map(e => e.timestamp)
            //maxDate = getMaxDate(oldMessagesDates);
            maxDate = new Date(new Date(Date.now() - 1 * 24 * 3600 * 1000)).getTime()
            condition = () => {
                return reachDate(new Date(maxDate))
            }
        } else
            condition = () => {
                return reachTop()
            }
        console.log('will process', unMatchChat.title)
        scrollToCondition(() => {
                return condition()
            })
            .then(e => {
                let newMessages = readCurrentChat() || [];
                let oldMessages = memGroup['messages'] || [];
                memGroup['messages'] = [oldMessages, newMessages];
                memGroup['lastExecutionTmp'] = lastExecutionTmp
                memGroup['maxDate'] = maxDate
                groups[memGroup.title] = memGroup
                db.groups = groups;
                save(db);
            })
            .catch(e => {
                console.log(e)
            });
    }
    await wait(300)
}

/*


//days ago
var daysAgo = 2;
var oldMessageTimestamp = new Date(new Date(Date.now() - 1 * 24 * 3600 * 1000))

//10 seconds to reach last 2 days
scrollToCondition(() => {
    return reachDate(oldMessageTimestamp)
});

//40 seconds to reach top
scrollToCondition(() => {
    return reachTop()
}, 40);
*/



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
            text: last.text,
            sender: last.sender ? {
                id: last.sender.user,
                displayName: last.senderObj.displayName,
                formattedName: last.senderObj.formattedName,
                formattedUser: last.senderObj.formattedUser,
            } : undefined
        } : undefined,
        createdAt: raw.groupMetadata.creation,
        users: Object.keys(raw.groupMetadata.participants._index).length
    }
}


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
    save(data)
}


/** not exist on database or lastMessageId not match */
function start() {
    chatItems = getHtmlChatItems()
    oldGroupExecution = load();
    unreadsByMessageId = Object.keys(chatItems)
        .filter(e => oldGroupExecution[e] === undefined || oldGroupExecution[e].lastMessage.id !== chatItems[e].lastMessage.id)
    console.log(unreadsByMessageId.length ? `Found ${unreadsByMessageId.length} unread group(s) 😕` : `Nothing to read 😍`);
    cleanAndSave(chatItems);
}
start();