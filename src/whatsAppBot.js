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
    "chat_title": [0, 0, 1, 0, 0, 0],
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
const scrollSpeedConfig = { 'robot': { min: 50, max: 100, length: 3000 }, 'fast': { min: 200, max: 400, length: 500 }, 'normal': { min: 1000, max: 2000, length: 300 }, 'slow': { min: 2000, max: 3000, length: 100 } }
var scrollSpeed = 'fast';

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
    if (chats) {
        chats = chats.childNodes;
        for (var i in chats) {
            if (!(chats[i] instanceof Element)) {
                continue;
            }
            const chat = chats[i]
            const title = getElement("chat_title", chat).innerText;
            const message = getElement("chat_lastmsg", chat).innerText;
            const timestamp = getElement("chat_lasttime", chat).innerText;
            const htmlElement = chat
            console.log({ title, message, timestamp, htmlElement })
        }
    }
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
const goAgain = (fn, sec) => {
    // const chat = document.querySelector('div.chat:not(.unread)')
    // selectChat(chat)
    setTimeout(fn, sec * 1000)
}

// Dispath an event (of click, por instance)
const eventFire = (el, etype) => {
    var evt = document.createEvent("MouseEvents");
    evt.initMouseEvent(etype, true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
    el.dispatchEvent(evt);
}

// Select a chat to show the main box
const selectChat = (chat, cb) => {
    const title = getElement("chat_title", chat).title;
    eventFire(chat.firstChild.firstChild, 'mousedown');
    if (!cb) return;
    const loopFewTimes = () => {
        setTimeout(() => {
            const titleMain = getElement("selected_title").title;
            if (titleMain !== undefined && titleMain != title) {
                console.log('not yet');
                return loopFewTimes();
            }
            return cb();
        }, 300);
    }

    loopFewTimes();
}

// Send a message
const sendMessage = (chat, message, cb) => {
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
function isAnValidChatGroup() {
    var groupUsers = getElement("group_users").title;
    var groupHas10UsersOrMore = /(?:.{10,25}\,){10,}/gmi.test(groupUsers);
    return groupHas10UsersOrMore
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
    const timestamp = new Date(match[6], match[4], match[5], match[3] === 'PM' ? parseInt(match[1]) + 12 : match[1], match[2], 0, 0);
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
            messages.push({ text, timestamp })
            lines.push({ author, contact, timestamp, messages, line })
        } else {
            //append last to the last one
            messages = lines[lines.length - 1].messages
            messages.push({ text, timestamp })
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