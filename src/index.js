import {
    retrieveWhatsAppsGroups,
    getGroupsBasicData,
    saveParticipantsList,
    saveWhatsAppGroups,
    saveMessages,
    retrieveWhatsMessages,
    requestWit
} from "./lib";
import JaroWrinker from 'jaro-winkler';

async function readMessages() {
    let AllGroups = await retrieveWhatsAppsGroups() || {}
    let sourceGroupKeys = Object.keys(AllGroups).filter(key => AllGroups[key] && AllGroups[key].type === 'source') || []
    let ignoreGroupKeys = Object.keys(AllGroups).filter(key => AllGroups[key] && AllGroups[key].type === 'target') || []

    let browserData = await getGroupsBasicData(sourceGroupKeys)
    console.log({
        sourceGroupKeys
    })

    let browserGroups = browserData.groups
    let browserParticipants = browserData.participants
    let browserMessages = browserData.messages

    /**
     * not update target groups
     * set source type on source groups
     */
    console.log(browserGroups)
    let browserGroupsKeys = Object.keys(browserGroups)
    for (let index = 0; index < browserGroupsKeys.length; index++) {
        const key = browserGroupsKeys[index];
        if (browserGroups[key] && AllGroups[key] && AllGroups[key].state)
            browserGroups[key].state = AllGroups[key].state
        if (ignoreGroupKeys.includes(key))
            delete browserGroups[key]
        else if (sourceGroupKeys.includes(key))
            browserGroups[key].type = AllGroups[key].type
    }

    console.log(browserGroups)
    saveParticipantsList(browserParticipants)
    saveWhatsAppGroups(browserGroups)
    saveMessages(browserMessages)
}


async function sendMessages() {
    let AllGroups = await retrieveWhatsAppsGroups() || {}
    let targetGroupKeys = Object.keys(AllGroups).filter(key => AllGroups[key] && AllGroups[key].type === 'target') || []
    let ignoreGroupKeys = Object.keys(AllGroups).filter(key => AllGroups[key] && AllGroups[key].type === 'source') || []


    console.log({
        targetGroupKeys
    })

    let browserData = await getGroupsBasicData([], true)
    let browserGroups = browserData.groups

    /**
     * not update source groups
     * set target type on target groups
     */
    let browserGroupsKeys = Object.keys(browserGroups)
    for (let index = 0; index < browserGroupsKeys.length; index++) {
        const key = browserGroupsKeys[index];
        if (browserGroups[key] && AllGroups[key] && AllGroups[key].state)
            browserGroups[key].state = AllGroups[key].state
        if (ignoreGroupKeys.includes(key))
            delete browserGroups[key]
        else if (targetGroupKeys.includes(key))
            browserGroups[key].type = AllGroups[key].type
    }

    let AllMessages = await retrieveWhatsMessages()

    //filter 24h messages only
    let yesterday = new Date().getTime() / 1000 - 24 * 60 * 60
    let msgsKeys = Object.keys(AllMessages).filter(key => AllMessages[key].t > yesterday)
    //link state to messages
    for (let index = 0; index < msgsKeys.length; index++) {
        const key = msgsKeys[index];
        let msg = AllMessages[key]
        msg.state = AllGroups[msg.g].state
        AllMessages[key] = msg
    }

    let JaroWrinker_sameUser = .9
    let JaroWrinker_differentUser = .8

    let noSpamm = {}
    for (let index = 0; index < msgsKeys.length; index++) {
        const key = msgsKeys[index];
        let msg = AllMessages[key]

        //the key is founded matching another message on noSpamm collection
        if (Object.keys(noSpamm).find(tempKey => noSpamm[tempKey] && noSpamm[tempKey].jaroWrinker && noSpamm[tempKey].jaroWrinker[key])) continue;

        //add new item on collection
        if (!noSpamm[key]) {
            noSpamm[key] = msg
            noSpamm[key].jaroWrinker = {}
        }

        msg.state = AllGroups[msg.g].state
        AllMessages[key] = msg

        for (let index2 = 0; index2 < msgsKeys.length; index2++) {
            const key2 = msgsKeys[index2];
            let msg2 = AllMessages[key2]

            if (key2 === key) continue
            let jaroSimilarity = JaroWrinker(msg.text, msg2.text)

            //save jaroSimilatiry on object
            if (msg2.senderId === msg.senderId && jaroSimilarity > JaroWrinker_sameUser)
                noSpamm[key].jaroWrinker[key2] = jaroSimilarity
            if (msg2.senderId !== msg.senderId && jaroSimilarity > JaroWrinker_differentUser)
                noSpamm[key].jaroWrinker[key2] = jaroSimilarity
        }
    }
    console.log({
        noSpamm
    })

    let noSpammKeys = Object.keys(noSpamm)
    let witClassificated = {}
    for (let index = 0; index < noSpammKeys.length; index++) {
        const key = noSpammKeys[index];
        let msg = noSpamm[key]
        msg.wit = await requestWit('https://api.wit.ai/message?v=20191001&q=', 'LYLIAYXEP6IRP6MOH7O7222VI4LVVAXG', msg.text)
        witClassificated[key] = msg
    }
    console.log({
        witClassificated
    })
    saveWhatsAppGroups(browserGroups)
}

let zapbot = window.zapBot
window.zapBot = {
    ...zapbot,
    readMessages,
    sendMessages,
    retrieveWhatsAppsGroups,
    getGroupsBasicData,
    saveWhatsAppGroups
}