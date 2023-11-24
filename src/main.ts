import { log } from 'console'
import chalk from 'chalk'
import { join, extname } from 'path'
import fetch from 'node-fetch'
import dotenv from 'dotenv'
import { translateImage } from './utils/translate-image.ts'
import { promises as fs } from "fs"
import { google } from 'googleapis'
import { translate } from './utils/translate.ts'
import { assetsDir, pyScriptsDir, rootDir } from './utils/paths.ts'
import { downloadVideo, getVideos } from './utils/index.ts'
import { promisify } from 'node:util';
import { exec as execCallback } from 'node:child_process';

const exec = promisify(execCallback)


dotenv.config()


const auth = new google.auth.GoogleAuth({
    keyFile: join(rootDir, 'token.json'),
    scopes: ['https://www.googleapis.com/auth/youtube.force-ssl'],
})
const youtube = google.youtube({ version: 'v3', auth })

// const mockVideoIds = JSON.parse(await fs.readFile('mock-ids.json', 'utf8')) as string[]


const processVideo = async (id: string) => {
    // thumbnail, description, video, tags
    const response = await youtube.videos.list({ part: ["snippet"], id: [id] })
    const v = response.data.items[0].snippet
    const thumbUrl = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`
    const desc = v.localized.description
    const name = v.title.replace(/[^a-zA-Z]/g, '')
    const dir = join(assetsDir, name)
    await fs.mkdir(dir)

    // Download audio
    await exec(`vot-cli --output=${dir} https://www.youtube.com/watch?v=${id}`)
    const files = await fs.readdir(dir)
    const audioName = files.filter(file => extname(file).toLowerCase() === '.mp3')[0]
    await fs.rename(join(dir, audioName), join(dir, 'audio.mp3'))

    await downloadVideo(id, dir)
    const [tTitle, tDesc, ...tTags] = await translate('ru', [v.title, desc, ...v.tags])
    const vPath = join(dir, 'video.mp4'), aPath = join(dir, 'audio.mp3'), outPath = join(dir, tTitle.replaceAll(' ', '-') + '.mp4')

    await exec(`ffmpeg -i ${vPath} -i ${aPath} -c copy ${outPath}`)
    // upload
}



try {
    // const ids = await getVideos("UCkCGANrihzExmu9QiqZpPlQ", youtube)
    // const ids = mockVideoIds.reverse() // reverse so the old are first
    processVideo("jNQXAC9IVRw")
    // ids.forEach(processVideo)
    // const jsonData = JSON.stringify(ids, null, 2)
    // const tThumbPath = await translateImage(thumbnailUrl)
    // log(tThumbPath)
} catch (e) {
    console.error(e)
}
