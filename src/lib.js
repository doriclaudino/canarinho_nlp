var _firebase_base_url = 'https://whatsappbot-c04b6.firebaseio.com/'
var _localStorageKey = 'zap_bot_key'
retry = require('async-retry')

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
function eventFire(el, etype) {
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

//maybe every 1h?
export async function getGroupsBasicData(groupKeysToRead = [], getLinks = false) {
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
            continue;
        }
        if (!rawData.isGroup) continue;

        if (getLinks) {
            try {
                console.log(`abrindo settings de ${rawData.name}`)
                await openGroupInvitationLinkScreen(htmlElement)
            } catch (error) {
                console.log(error)
            }
        }

        groupMetadata = rawData.groupMetadata
        participantGroups = {}
        participantGroups[rawData.id.user] = true
        Object.keys(groupMetadata.participants._index).forEach(key => {
            let participantObject = groupMetadata.participants._index[key]
            userId = participantObject.id.user
            name = participantObject.contact.name
            img = participantObject.contact.profilePicThumb ? participantObject.contact.profilePicThumb.img : undefined

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
        //we allow to read messages from this group
        if (groupKeysToRead.length && groupKeysToRead.includes(rawData.id.user)) {
            try {
                let chatopened = await selectChat(htmlElement)
                //dois dias atras
                let diffdays = 2
                let compareToDate = new Date(new Date().getTime() - (diffdays * 24 * 60 * 60 * 1000)).getTime() / 1000;
                let chatMsgsHtml = document.querySelector('div._1ays2')
                let chatMsgsReact = findReactComponent(chatMsgsHtml);
                let reachCondition = await loadMessagesUntilCondition(() => reachDate(chatMsgsReact.props.msgs, compareToDate) || reachEncryptionNotification(chatMsgsReact.props.msgs))
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
                    text: msg.text
                }
            }
            lastMessageId = rawData.msgs._last.id.id
        }
        console.log(rawData)
        groupData[rawData.id.user] = {
            //htmlElement,
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


const saveOnFirebase = async (collection, data) =>
    retry(async (bail, num) => {
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

const openGroupInvitationLinkScreen = async (htmlElement) => {
    await selectChat(htmlElement)
    await openGroupMenuOptions()
    await openMenuDrawer()
    await openInviteGroupViaLinkDrawer()
    return true
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
        if (!isActive) throw new Error(`Menu Drawer not visible`)
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

const selectChat = async (chat) =>
    retry(async (bail, num) => {
        eventFire(chat.firstChild.firstChild.firstChild, 'mousedown');
        eventFire(chat.firstChild.firstChild, 'mousedown');
        let isActive = findReactComponent(chat).props.data.data.presence.chatActive
        if (isActive) {
            bail(true)
            return true
        } else
            throw new Error('We clicked and not activated')
    }, {
        minTimeout: 200,
        maxTimeout: 400
    });

export function saveMessages(dataToSave, saveOnStorage = true) {
    let collectionName = 'messages'
    if (saveOnStorage) {
        let loadedLocalData = load()
        loadedLocalData[collectionName] = dataToSave
        save(loadedLocalData)
    }
    return saveOnFirebase(collectionName, dataToSave)
}

export function saveWhatsAppGroups(dataToSave, saveOnStorage = true) {
    let collectionName = 'whatsAppGroups'
    if (saveOnStorage) {
        let loadedLocalData = load()
        loadedLocalData[collectionName] = dataToSave
        save(loadedLocalData)
    }
    return saveOnFirebase(collectionName, dataToSave)
}

export function saveParticipantsList(dataToSave, saveOnStorage = true) {
    let collectionName = 'participants'
    if (saveOnStorage) {
        let loadedLocalData = load()
        loadedLocalData[collectionName] = dataToSave
        save(loadedLocalData)
    }
    return saveOnFirebase(collectionName, dataToSave)
}



function reachEncryptionNotification(msgs) {
    return msgs.find(e => e.type === "e2e_notification" && e.subtype === "encrypt")
}

function reachDate(msgs, desiredTimestamp) {
    return msgs.find(e => e.t < desiredTimestamp)
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