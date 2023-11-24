import { promises as fs } from "fs"
import { createWriteStream } from 'fs'
import { youtube_v3 } from 'googleapis'
import ytdl from 'ytdl-core'


export const randChoice = (a: any[]) => a[Math.floor(Math.random() * a.length)]


export const randint = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min


/**
 * Returns all video ids from the channel starting from new to old, e.g. ids[0] is the newest
*/
export const getVideos = async (channelId: string, youtube: youtube_v3.Youtube): Promise<string[] | undefined> => {
    try {
        let nextPageToken: string | undefined, channelVideos: string[] = []
        do {
            const response = await youtube.search.list({
                part: ["id", "snippet"],
                channelId,
                maxResults: 300,
                order: "date",
                regionCode: "US",
                ...(nextPageToken && { pageToken: nextPageToken })
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


export async function downloadVideo(id: string, dir: string) {
    const url = 'https://www.youtube.com/watch?v=' + id
    const videoInfo = await ytdl.getInfo(url)
    const videoFormat = ytdl.chooseFormat(videoInfo.formats, { quality: 'lowestvideo' }) // SIC highestvideo

    const videoReadableStream = ytdl(url, { format: videoFormat })
    const fileWriteStream = createWriteStream(`${dir}/video.mp4`)

    await new Promise((resolve, reject) => {
        videoReadableStream.pipe(fileWriteStream)
        videoReadableStream.on('end', resolve)
        videoReadableStream.on('error', reject)
        fileWriteStream.on('error', reject)
    })
}

