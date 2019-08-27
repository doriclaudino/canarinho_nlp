//
// GLOBAL VARS AND CONFIGS
//
var lastMessageOnChat = false;
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
    "chat_history": [0, 0, 5, 3, 0, 4, 0], //.lastChild.lastChild.children,
    //getElement('chat_history').lastChild.scrollTo(0,-100);
    "chat_line_sender_number": [1,2,0,0],
    "chat_line_sender_name": [1,2,0,1],
    "chat_line_sender_message": [1,2,1,0,0,0], //innerText
    "chat_line_sender_raw_timestamp": [1,2,1], //getAttribute('data-pre-plain-text');
};
var unreadThreshold = 5; //5 chats unread, loop start again
var minLoopInterval = rand(120, 60) * 1000; //between 1-2min
var groupLastReadTimestamp = {}

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

function getAllChats(){
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
            console.log({title, message, timestamp, htmlElement})
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


start = () => {
    //fix loop correctly
    var unread = getUnreadChats();
    Object.keys(unread).forEach(index => {
        var chat = unread[index]
        var title = getElement("selected_title").title;
        var groupUsers = getElement("group_users").title;

        //check if got 10+ string separated by comma (around 100+ chars)
        var groupHas10UsersOrMore = /(?:.{10,25}\,){10,}/gmi.test(groupUsers);
        console.log(`group: ${title} - isValidGroup: ${groupHas10UsersOrMore}`);
    })
}

start();

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

async function readAsyncAllMessages() {
    if (reachTop())
        return new Promise.resolve(true);
    
    let promise = new Promise((resolve, reject) => {
        var interval = setInterval(() => {
            if (reachTop()) {
                clearInterval(interval);
                resolve(true);
            }
            scrollChatTop(); 
    }, rand(2000, 800));
            }) ;  
  return promise;
}

function scrollChatTop() {
    getElement('chat_history').lastChild.scrollTo(0, -100);
}

senderNumber = linha.childNodes[1].childNodes[2].childNodes[0].childNodes[0]
senderName = linha.childNodes[1].childNodes[2].childNodes[0].childNodes[1]
text = linha.childNodes[1].childNodes[2].childNodes[1].childNodes[0].childNodes[0].childNodes[0].innerText
timestap = linha.childNodes[1].childNodes[2].childNodes[1].getAttribute('data-pre-plain-text');
const regex = /\[(\d{1,2})\:(\d{1,2})\s(.{2})..(\d{1,2})\/(\d{1,2})\/(\d{1,4})\]/gmi;
match = regex.exec(timestap)
messageTimestamp = new Date(match[6],match[4],match[5],match[3]==='PM'?parseInt(match[1])+12:match[1],match[2],0,0);

var linhas = []
var chat_history = getElement("chat_history").;
Array.from(chat_history.lastChild.lastChild.children).forEach((linha, index) => {
    message = getElement('chat_line_sender_message', linha).innerText;
    linha.childNodes[1].childNodes[0].children == 2 //is an append
    linha.childNodes[1].childNodes[0].children == 3 //theres a new topic with name
    linha.childNodes[1].childNodes[0].children == 4 //theres a new topic replay audio
    console.log(linha)
    console.log(message)

    // senderNumber = getElement('chat_line_sender_number', linha).innerText;
    // senderName = getElement('chat_line_sender_name', linha).innerText;
    // message = getElement('chat_line_sender_message', linha).innerText;
    // rawTimestap = getElement('chat_line_sender_raw_timestamp', linha).getAttribute('data-pre-plain-text');
    // const regex = /\[(\d{1,2})\:(\d{1,2})\s(.{2})..(\d{1,2})\/(\d{1,2})\/(\d{1,4})\]/gmi;
    // match = regex.exec(rawTimestap)
    // timestamp = undefined
    // if(match && match.length>5)
    // timestamp = new Date(match[6],match[4],match[5],match[3]==='PM'?parseInt(match[1])+12:match[1],match[2],0,0);
    // htmlElement = linha
    
    // console.log(message)
    // if(message!==undefined){
    //     console.log(message)
    //     linhas[index-1].message += `\n ${message}`
    // }else{
    //     linhas.push({senderNumber, senderName, timestamp, message, htmlElement })
    // }
});


//filter initial bubbles to get the userName, phone
//then the following lines will be appended
Array.from(getElement("chat_history").lastChild.lastChild.children)
.filter(e=>e.querySelector('span.tail-container.highlight') && e.querySelector('div.message-in'))
