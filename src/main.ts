import { log } from 'console'
import chalk from 'chalk'
import { join, extname } from 'path'
import fetch from 'node-fetch'
import * as dotenv from 'dotenv'
import { translateImage } from './utils/translate-image.ts'
import { promises as fs, createReadStream } from "fs"
import { google, youtube_v3 } from 'googleapis'
import { translate } from './utils/translate.ts'
import { assetsDir, credsDir } from './utils/paths.ts'
import { downloadTranslatedAudio, downloadVideo, exec, getVideos } from './utils/index.ts'
import { promisify } from 'node:util'
import { uploadVideo } from './utils/upload-video.ts'


dotenv.config()


const auth = new google.auth.GoogleAuth({
    keyFile: join(credsDir, 'service-token.json'),
    scopes: ['https://www.googleapis.com/auth/youtube.force-ssl'],
})
const youtube = google.youtube({ version: 'v3', auth })

// const mockVideoIds = JSON.parse(await fs.readFile('mock-ids.json', 'utf8')) as string[]


const processVideo = async (id: string, targetLang: string) => {
    const response = await youtube.videos.list({ part: ["snippet"], id: [id] })
    const v = response.data.items[0].snippet
    const t = v.thumbnails
    const thumbUrl = t.maxres?.url || t.high?.url || t.standard.url
    const desc = v.localized.description
    const name = v.title.replace(/[^a-zA-Z]/g, '')
    const dir = join(assetsDir, name)
    await fs.mkdir(dir)

    await Promise.all([
        downloadTranslatedAudio(dir, id, targetLang),
        downloadVideo(id, dir),
        translateImage(thumbUrl, targetLang, dir),
    ])

    const [tTitle, tDesc, ...tTags] = await translate('ru', [v.title, desc, ...v.tags])
    // // Merge video and audio
    const vPath = join(dir, 'video.mp4'), aPath = join(dir, 'audio.mp3'), outPath = join(dir, tTitle.replaceAll(' ', '-') + '.mp4')
    await exec(`ffmpeg -i ${vPath} -i ${aPath} -c copy ${outPath}`)

    // // Upload video
    const u = uploadVideo({
        dirName: dir,
        title: tTitle,
        desc: tDesc,
        tags: tTags,
        categoryId: v.categoryId,
        lang: targetLang,
    })

    log(u)
    // // delete the folder
}



try {
    // const ids = await getVideos("UCkCGANrihzExmu9QiqZpPlQ", youtube)
    // const ids = mockVideoIds.reverse() // reverse so the old are first
    processVideo("jNQXAC9IVRw", 'ru')
    // ids.forEach(processVideo)
    // const jsonData = JSON.stringify(ids, null, 2)
    // const tThumbPath = await translateImage(thumbnailUrl)
    // log(tThumbPath)
} catch (e) {
    console.error(e)
}
