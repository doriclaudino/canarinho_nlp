var _firebase_base_url = 'https://whatsappbot-c04b6.firebaseio.com/'
var _localStorageKey = 'zap_bot_key'
import * as retry from "async-retry";

var htmlElements = {
    chatList: {
        selector: 'div#pane-side',
        path: [0, 0]
    },
    selected_title: {
        path: [0, 0, 5, 3, 0, 1, 1, 0, 0, 0]
    },
    chat_history: {
        path: [0, 0, 5, 3, 0, 4, 0]
    },
    chat_menu: {
        selector: '#main > header > div._2kYeZ > div > div:nth-child(3) > div[title="Menu"]'
    },
    group_info: {
        selector: 'div[role="button"][title="Group info"]'
    }
}

function findReactComponent(htmlNodeElement) {
    for (const key in htmlNodeElement) {
        if (key.startsWith('__reactInternalInstance$')) {
            const fiberNode = htmlNodeElement[key];
            return fiberNode && fiberNode.return && fiberNode.return.stateNode;
        }
    }
    return null;
};


// Dispath an event (of click, por instance)
export function eventFire(el, etype) {
    var evt = document.createEvent("MouseEvents");
    evt.initMouseEvent(etype, true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
    el.dispatchEvent(evt);
}

function getHtmlElement(name) {
    if (!htmlElements[name]) {
        return false;
    }
    var finder = htmlElements[name];
    var parent = document.querySelector(finder.selector);
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


const saveOnFirebase = async (collection, data, pathTransform = true) =>
    retry(async (bail, num) => {
        console.log(`saveOnFirebase ${collection}`, data)
        if (pathTransform)
            data = pathAtributes(data)
        var full_url_data_json = `${_firebase_base_url}${collection}.json`
        const res = await fetch(full_url_data_json, {
            method: 'PATCH',
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                ...data
            })
        })
        return res
    }, {
        minTimeout: 400,
        maxTimeout: 600
    });

function save(data) {
    return localStorage.setItem(_localStorageKey, JSON.stringify(data))
}

function load() {
    return JSON.parse(localStorage.getItem(_localStorageKey)) || {}
}

async function openGroupInvitationLinkScreen(htmlElement) {
    try {
        await selectChat(htmlElement)
        await openGroupMenuOptions()
        await openMenuDrawer()
        await openInviteGroupViaLinkDrawer()
    } catch (error) {
        console.log(error)
    }
}

const openInviteGroupViaLinkDrawer = async () =>
    retry(async (bail, num) => {
        let isActive = isInviteGroupViaLinkDrawerOpened()
        if (isActive === true) {
            bail(true)
            return
        }
        eventFire(document.querySelectorAll('div._3H4MS')[1], 'click');

        //confirm the header
        isActive = document.querySelector('div._1pYs5').textContent === "Invite to group via link"
        if (!isActive) throw new Error(`Invite Group Via Link Drawer not visible`)
        return isActive
    }, {
        minTimeout: 200,
        maxTimeout: 400
    });

const openMenuDrawer = async () =>
    retry(async (bail, num) => {
        let isActive = isInviteGroupViaLinkDrawerOpened()
        if (isActive === true) {
            bail(true)
            return
        }
        eventFire(getHtmlElement('group_info'), 'click')

        //confirm text on list
        isActive = document.querySelectorAll('div._3H4MS')[1].textContent === "Invite to group via link"
        if (!isActive) throw new Error(`Invite to group via link nao disponivel`)
        return isActive
    }, {
        minTimeout: 200,
        maxTimeout: 400
    });

const isInviteGroupViaLinkDrawerOpened = () => document.querySelector('div._1pYs5') && document.querySelector('div._1pYs5').textContent === "Invite to group via link"
const isInviteGroupInfoDrawerOpened = () => getHtmlElement('group_info') && getHtmlElement('group_info').textContent === "Group info"

const openGroupMenuOptions = async () =>
    retry(async (bail, num) => {
        let isActive = isInviteGroupViaLinkDrawerOpened()
        if (isActive === true) {
            bail(true)
            return
        }
        eventFire(getHtmlElement('chat_menu'), 'mousedown');
        //confirm the Group info button text
        isActive = isInviteGroupInfoDrawerOpened()
        if (!isActive) throw new Error(`Group Menu Options not visible`)
        return isActive
    }, {
        minTimeout: 200,
        maxTimeout: 400
    });

export const selectChat = async (chat) =>
    retry(async (bail, num) => {
        console.log(chat, num)
        eventFire(chat.firstChild.firstChild.firstChild, 'mousedown');
        eventFire(chat.firstChild.firstChild, 'mousedown');
        let isActive = findReactComponent(chat).props.data.data.presence.chatActive
        if (!isActive)
            throw new Error('We clicked and not activated')
        return true
    }, {
        minTimeout: 200,
        maxTimeout: 400
    });

export function saveMessages(dataToSave, pathTransform = true, saveOnStorage = true) {
    let collectionName = 'messages'
    if (saveOnStorage) {
        let loadedLocalData = load()
        loadedLocalData[collectionName] = dataToSave
        save(loadedLocalData)
    }
    return saveOnFirebase(collectionName, dataToSave, pathTransform)
}

export function saveWhatsAppGroups(dataToSave, pathTransform, saveOnStorage = true) {
    let collectionName = 'whatsAppGroups'
    if (saveOnStorage) {
        let loadedLocalData = load()
        loadedLocalData[collectionName] = dataToSave
        save(loadedLocalData)
    }
    return saveOnFirebase(collectionName, dataToSave, pathTransform)
}

export function saveParticipantsList(dataToSave, pathTransform, saveOnStorage = true) {
    let collectionName = 'participants'
    if (saveOnStorage) {
        let loadedLocalData = load()
        loadedLocalData[collectionName] = dataToSave
        save(loadedLocalData)
    }
    return saveOnFirebase(collectionName, dataToSave, pathTransform)
}

export function saveRobots(dataToSave, pathTransform, saveOnStorage = true) {
    let collectionName = 'robots'
    if (saveOnStorage) {
        let loadedLocalData = load()
        loadedLocalData[collectionName] = dataToSave
        save(loadedLocalData)
    }
    return saveOnFirebase(collectionName, dataToSave, pathTransform)
}

export function updateCurrentUser() {
    let user = findCurrentUser()
    return saveRobots(user)
}


export function findCurrentUser() {
    let chats = document.querySelectorAll('div.X7YrQ')
    let executionerObject = {}

    for (let index = 0; index < chats.length; index++) {
        const chat = chats[index];
        let reactObject = findReactComponent(chat)
        let reactData = reactObject.props.data.data
        if (reactData.isUser) continue
        let found = reactData.groupMetadata.participants.models.map(e => e.contact).find(contact => contact.isMe)
        if (found) {
            executionerObject[found.id.user] = {
                displayName: found.displayName,
                formattedUser: found.formattedUser,
                img: found.profilePicThumb ? found.profilePicThumb.eurl : undefined,
            }
        }
        break;
    }
    return executionerObject
}

function pathAtributes(object, _key = '', paths = {}) {
    if (object === null || typeof object !== 'object') return [_key, object]
    let path = ''
    let keys = Object.getOwnPropertyNames(object)
    for (const key in keys) {
        path = _key.length ? _key + '/' + keys[key] : keys[key]
        let values = pathAtributes(object[keys[key]], path, paths)
        if (values[1] === undefined || values[1] === null) continue
        if (values[0])
            paths[values[0]] = values[1]
    }
    return paths
}

function reachEncryptionNotification(msgs) {
    return msgs.find(e => e.type === "e2e_notification" && e.subtype === "encrypt")
}

function reachDate(msgs, desiredTimestamp) {
    return msgs.find(e => e.t < desiredTimestamp)
}

const getOnFirebase = async (collection) =>
    retry(async (bail, num) => {
        var full_url_data_json = `${_firebase_base_url}${collection}.json`
        const res = await fetch(full_url_data_json, {
            method: 'get',
            headers: {
                'Access-Control-Allow-Origin': '*'
            }
        })
        return res.json()
    });

export const retrieveWhatsAppsGroups = () => getOnFirebase('whatsAppGroups')

export const retrieveWhatsMessages = () => getOnFirebase('messages')

export const retrieveRobots = () => getOnFirebase('robots')

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


//maybe every 1h?
export async function getGroupsBasicData(firebaseSavedGroups = {}, getLinks = false) {
    let html = getHtmlElement('chatList')
    let total = html.childNodes[0].childElementCount
    let groupData = {}
    let participants = {}
    let messages = {}
    for (let index = 0; index < total; index++) {
        let htmlElement = html.childNodes[0].childNodes[index];
        let reactComponent = findReactComponent(htmlElement);
        let rawData = null

        try {
            rawData = reactComponent.props.data.data
        } catch (error) {
            console.log(error)
            continue;
        }
        if (!rawData.isGroup) continue;

        if (getLinks) {
            await openGroupInvitationLinkScreen(htmlElement)
        }

        let groupMetadata = rawData.groupMetadata
        let participantGroups = {}
        participantGroups[rawData.id.user] = true
        Object.keys(groupMetadata.participants._index).forEach(key => {
            let participantObject = groupMetadata.participants._index[key]
            let userId = participantObject.id.user
            let name = participantObject.contact.name
            let img = participantObject.contact.profilePicThumb ? participantObject.contact.profilePicThumb.img : undefined

            let mergeGroups = participants[userId] ? participants[userId].groups : {}
            participants[userId] = {
                name,
                img,
                groups: {
                    ...mergeGroups,
                    ...participantGroups
                }
            }
        })

        let minTimestamp = undefined
        let maxTimestamp = undefined
        let lastMessageId = undefined
        let sourceGroupKeys = Object.keys(firebaseSavedGroups).filter(key => firebaseSavedGroups[key] && firebaseSavedGroups[key].type === 'source') || []
        let groupKey = rawData.id.user

        if (!Object.keys(firebaseSavedGroups).includes(groupKey)) {
            console.log(`Group ${rawData.formattedTitle} (${groupKey}) - first time, saving only basic data.`)
        }

        //we allow to read messages from this group
        if (sourceGroupKeys.length && sourceGroupKeys.includes(groupKey)) {
            try {
                let firebaseGroup = firebaseSavedGroups[groupKey]

                let compareToDate = undefined
                let temporaryMinTimeStamp = Object.keys(rawData.msgs.models).map(k => rawData.msgs.models[k].t).sort((a, b) => a - b)[0]

                if (firebaseGroup && firebaseGroup.maxTimestamp && firebaseGroup.lastMessageId) {
                    //is not a new group

                    //same id just skip
                    if (firebaseGroup.lastMessageId === rawData.msgs._last.id.id)
                        throw new Error(`Group ${rawData.formattedTitle} (${groupKey}) - same lastMessageId found on lastExecution, don't need to open the chat.`)

                    if (temporaryMinTimeStamp > firebaseGroup.maxTimestamp) {
                        //find gap between maxDatetime online with minDatetime on group msgs
                        console.log(`Group ${rawData.formattedTitle} (${groupKey}) - time-gap found! more: fbsMax: ${firebaseGroup.maxTimestamp} minMsg:${temporaryMinTimeStamp} opening the chat!`)
                        compareToDate = firebaseGroup.maxTimestamp;
                    } else {
                        //no gap found, the oldmessage on groupdata is older than maxTimestamp, in other words theres no gap
                        throw new Error(`Group ${rawData.formattedTitle} (${groupKey}) - no time-gap found, more: fbsMax: ${firebaseGroup.maxTimestamp} minMsg:${temporaryMinTimeStamp}, we dont need to open the chat`)
                    }
                }

                if (!firebaseGroup.lastMessageId || !firebaseGroup.maxTimestamp) {
                    console.log(`Group ${rawData.formattedTitle} (${groupKey}) - never read full msgs, looking four 48h messages from now`)
                    let diffdays = 2
                    compareToDate = new Date(new Date().getTime() - (diffdays * 24 * 60 * 60 * 1000)).getTime() / 1000;
                }
                await selectChat(htmlElement)
                await loadMessagesUntilCondition(compareToDate)
            } catch (error) {
                console.log(error)
            }

            minTimestamp = Infinity
            maxTimestamp = 0
            for (let index = 0; index < rawData.msgs.models.length; index++) {
                const msg = rawData.msgs.models[index];

                minTimestamp = Math.min(minTimestamp, msg.t)
                maxTimestamp = Math.max(maxTimestamp, msg.t)

                //memoize
                if (messages[msg.id.id]) continue

                if (msg.type !== 'chat') continue
                if (!msg.text) continue
                if (msg.sender === undefined) continue

                let tempText = removeDoubleSpaces(msg.text)
                if (!passExtendedCleanRules(tempText)) continue
                messages[msg.id.id] = {
                    t: msg.t,
                    senderId: msg.sender.user,
                    text: msg.text,
                    g: rawData.id.user
                }
            }
            lastMessageId = rawData.msgs._last.id.id
        }
        groupData[rawData.id.user] = {
            htmlElement,
            formattedTitle: rawData.formattedTitle,
            desc: rawData.groupMetadata.desc,
            groupInviteLink: rawData.groupMetadata.groupInviteLink,
            owner: rawData.groupMetadata.owner.user,
            restrict: rawData.groupMetadata.restrict,
            lastMessageId,
            minTimestamp,
            maxTimestamp
        }
    }
    return {
        groups: groupData,
        participants,
        messages
    }
}

const loadMessagesUntilCondition = async (compareDate) =>
    retry(async (bail, num) => {
        if (!compareDate)
            bail(new Error(`invalid date to compare ${compareDate}`))

        let chatMsgsHtml = document.querySelector('div._1ays2')
        let chatMsgsReact = findReactComponent(chatMsgsHtml);
        let msgs = chatMsgsReact.props.msgs || []
        let reachDesiredDate = reachDate(msgs, compareDate)

        if (!reachDesiredDate) {
            let reachEncryptDate = reachEncryptionNotification(msgs)
            if (!reachEncryptDate) {
                scrollChatTop()
                throw new Error(`Cannot load encrypt msg or date`)
            }
        }
        return true
    }, {
        minTimeout: 500,
        maxTimeout: 1000,
        retries: 20
    });

export const requestWit = async (baseUrl, token, message) =>
    retry(async (bail, num) => {
        console.log(`requestWit ${message} num${num}`)
        let encodedMessage = encodeURIComponent(message)
        let res = await fetch(`${baseUrl}${encodedMessage}`, {
            method: 'get',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        return res.json()
    }, {
        minTimeout: 1100,
        maxTimeout: 1500,
    });


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
export function boldMessagesBeforeSend(messagesToBold) {
    let processedOnWit = Object.keys(messagesToBold).filter(key => messagesToBold[key].wit && messagesToBold[key].wit.entities && messagesToBold[key].wit.entities.intent)
    processedOnWit.forEach(key => {
        let object = messagesToBold[key]
        object.boldtext = object.text
        object = addMessagePhoneNumber(object)
        object = addBoldAroundEntities(object)
        messagesToBold[key] = object
    })
    return messagesToBold
}


export function GroupsByState(groupList) {
    return Object.entries(groupList).reduce((prev, curr) => {
        prev[curr[1].state] ? prev[curr[1].state].push(curr[0]) : prev[curr[1].state] = [curr[0]]
        return prev
    }, {})
}

//we can improve with retry
export async function sendOneMessage(chatHtml, message) {
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