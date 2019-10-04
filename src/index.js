import {
    retrieveWhatsAppsGroups,
    getGroupsBasicData,
    saveParticipantsList,
    saveWhatsAppGroups,
    saveMessages
} from "./lib";

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
        if (ignoreGroupKeys.includes(key))
            delete browserGroups[key]
        else if (targetGroupKeys.includes(key))
            browserGroups[key].type = AllGroups[key].type
    }
    console.log(browserGroups)
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