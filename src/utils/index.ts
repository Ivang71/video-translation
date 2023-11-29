import { promises as fs } from "fs"
import { createWriteStream } from 'fs'
import { youtube_v3 } from 'googleapis'
import ytdl from 'ytdl-core'
import { join, extname } from 'path'
import { promisify } from 'node:util'
import winston from 'winston'
import { exec as execCallback } from 'node:child_process'
import { assetsDir } from "./paths.ts"
import { translate } from "./translate.ts"
import { translateImage } from "./translate-image.ts"
import Innertube from "youtubei.js/agnostic"


export const exec = promisify(execCallback)


export const randChoice = (a: any[]) => a[Math.floor(Math.random() * a.length)]


export const randint = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min


export const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }), // Customize timestamp format
        winston.format.printf(info => `${info.timestamp}`), 
        winston.format.simple(),
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/application.log', maxsize: 5 * 1024 * 1024, maxFiles: 1 }),
    ],
})


export const wait = (timeout: number) => new Promise<void>(r => setTimeout(r, timeout))


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
    const videoFormat = ytdl.chooseFormat(videoInfo.formats, { quality: 'highestvideo' }) // SIC highestvideo

    const videoReadableStream = ytdl(url, { format: videoFormat })
    const fileWriteStream = createWriteStream(`${dir}/video.mp4`)

    await new Promise((resolve, reject) => {
        videoReadableStream.pipe(fileWriteStream)
        videoReadableStream.on('end', resolve)
        videoReadableStream.on('error', reject)
        fileWriteStream.on('error', reject)
    })
}


export const downloadTranslatedAudio = async (dir: string, id: string, targetLang: string) => {
    await exec(`vot-cli --output=${dir} --reslang=${targetLang} https://www.youtube.com/watch?v=${id}`)
    const files = await fs.readdir(dir)
    const audioName = files.filter(file => extname(file).toLowerCase() === '.mp3')[0]
    await fs.rename(join(dir, audioName), join(dir, 'audio.mp3'))
}


export const processVideo = async (id: string, targetLang: string, youtube: youtube_v3.Youtube, yt: Innertube): Promise<boolean> => {
    const response = await youtube.videos.list({ part: ["snippet"], id: [id] })
    const v = response.data.items[0].snippet
    const t = v.thumbnails
    const thumbUrl = t.maxres?.url || t.high?.url || t.standard.url
    const desc = v.localized.description
    const name = v.title.replace(/[^a-zA-Z]/g, '')
    const dir = join(assetsDir, name)
    await fs.mkdir(dir)

    let [tTitle, tDesc, ...tTags] = (await Promise.all([
        translate(targetLang, [v.title, desc, ...v.tags]),
        translateImage(thumbUrl, targetLang, dir),
        downloadTranslatedAudio(dir, id, targetLang),
        downloadVideo(id, dir),
    ]))[0]

    // Merge video and audio
    const vPath = join(dir, 'video.mp4'), aPath = join(dir, 'audio.mp3'),
        outPath = join(dir, tTitle.replaceAll(' ', '-') + '.mp4')
    await exec(`ffmpeg -i ${vPath} -i ${aPath} -c copy ${outPath}`)

    // make total tags length < 350
    let maxLength = 350
    tTags = tTags.filter((str) => {
        maxLength -= str.length
        return maxLength >= 0
    })

    const video = await fs.readFile(outPath)

    const upload = await yt.studio.upload(video.buffer, {
        title: tTitle,
        description: tDesc,
        privacy: 'PUBLIC'
    })
    if (!upload.data.videoId) return false
    
    console.log(!upload.data.videoId)

    const thumb = await fs.readFile(join(dir, 'thumb.jpg'))
    const thumbUpload = await yt.studio.setThumbnail(upload.data.videoId, thumb)

    setTimeout(() => fs.rm(dir, { recursive: true, force: true }), 60 * 1000)
    // fs.rm(dir, { recursive: true, force: true })
    return thumbUpload.success ? true : false

    // // Uploading via the official api (quickly hits quota)
    // return new Promise((resolve, reject) => {
    //     uploadVideo({
    //         dirName: dir,
    //         title: tTitle,
    //         desc: tDesc,
    //         tags: tTags,
    //         categoryId: v.categoryId,
    //         lang: targetLang,
    //         callback: (err, res) => {
    //             console.log('Got response: ', res)
    //             if (err) throw err
    //             // if (res.status === 403) resolve(false)
    //             fs.rm(dir, { recursive: true, force: true })
    //             resolve(true)
    //         }
    //     })
    // })
}
