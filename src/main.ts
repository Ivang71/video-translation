import { log } from 'console'
import chalk from 'chalk'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'
import fetch from 'node-fetch'
import dotenv from 'dotenv'
import { Innertube, UniversalCache, YTNodes } from 'youtubei.js'
import { translateImage } from './utils/translate-image.ts'
import * as fs from 'fs'
import { google } from 'googleapis'


dotenv.config()

const currentModuleFile = fileURLToPath(import.meta.url)
const currentDirectory = dirname(currentModuleFile)
export const rootDirectory = join(currentDirectory, '..')
export const assetsDirectory = join(rootDirectory, 'assets')


const auth = new google.auth.GoogleAuth({
    keyFile: join(rootDirectory, 'token.json'),
    scopes: ['https://www.googleapis.com/auth/youtube.force-ssl'],
})
const youtube = google.youtube({version: 'v3', auth})

const mockVideoIds = JSON.parse(fs.readFileSync('mock-ids.json', 'utf8')) as string[]


/**
 * Returns all video ids from the channel starting from new to old, e.g. ids[0] is the newest
*/
const getVideos = async (channelId: string): Promise<string[] | undefined> => {
    try {
        let nextPageToken: string | undefined, channelVideos: string[] = []
        do {
            const response = await youtube.search.list({
                part: ["id", "snippet"],
                channelId,
                maxResults: 300,
                order: "date",
                regionCode: "US",
                ...(nextPageToken && {pageToken : nextPageToken})
            })
            const videos = response.data.items.map(i => i.id.videoId)
            if (videos.length) channelVideos.push(...videos)
            nextPageToken = response.data.nextPageToken
        } while (nextPageToken)

        return channelVideos.filter(id => id)
    } catch (error) {
        console.error(`Error getting videos from channel ${channelId}: `, error.message)
    }
}

const processVideo = async (id: string) => {
    // thumbnail, description, video, tags
    const response = await youtube.videos.list({part: ["snippet"], id: ["aVZ1sSnIKrg"]})
    const v = response.data.items[0].snippet
    const thumbUrl = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`
    const title = v.title
    const description = v.localized.description
    const tags = v.tags
}


try {
    // const ids = await getVideos("UCkCGANrihzExmu9QiqZpPlQ")
    const ids = mockVideoIds.reverse() // reverse so the old are first
    processVideo(ids[0])
    // ids.forEach(processVideo)
    // const jsonData = JSON.stringify(ids, null, 2)
    // const tThumbPath = await translateImage(thumbnailUrl)
    // log(tThumbPath)
} catch (e) {
    console.error(e)
}
