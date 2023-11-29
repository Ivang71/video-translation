import { log } from 'console'
import { join } from 'path'
import * as dotenv from 'dotenv'
import { promises as fs, existsSync } from 'fs'
import { google } from 'googleapis'
import { assetsDir, credsDir } from './utils/paths.ts'
import { getVideos, logger, processVideo, wait } from './utils/index.ts'
import { Innertube, UniversalCache } from 'youtubei.js'
import { MongoClient, ServerApiVersion } from 'mongodb'
import { SourceChannel } from './types/index.ts'


dotenv.config()

const sourceChannelId = process.env.YOUTUBE_SOURCE_CHANNEL_ID
const targetLang = process.env.TARGET_LANG

const auth = new google.auth.GoogleAuth({
    keyFile: join(credsDir, 'service-token.json'),
    scopes: ['https://www.googleapis.com/auth/youtube.force-ssl'],
})
const youtube = google.youtube({ version: 'v3', auth })

const uri = `mongodb+srv://user:${process.env.ATLAS_PASSWORD}@cluster0.3zsxqmx.mongodb.net/?retryWrites=true&w=majority`
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
})

const creds_path = join(credsDir, 'inner-tube-token.json')
const creds = existsSync(creds_path) ? JSON.parse((await fs.readFile(creds_path)).toString()) : undefined

const yt = await Innertube.create({ cache: new UniversalCache(false) })

yt.session.on('auth-pending', async (data: any) => {
    console.info(`Hello!\nOn your phone or computer, go to ${data.verification_url} and enter the code ${data.user_code}`)
})

yt.session.on('auth', async (data: any) => {
    await fs.writeFile(creds_path, JSON.stringify(data.credentials))
    console.info('Successfully signed in!')
})

yt.session.on('update-credentials', async (data: any) => {
    await fs.writeFile(creds_path, JSON.stringify(data.credentials))
    console.info('Credentials updated!', data)
})

await yt.session.signIn(creds)


try {
    await client.connect()
    const database = client.db('youtube')
    const channelsCollection = database.collection('channels')
    let sourceChannel = await channelsCollection.findOne<SourceChannel>({ id: sourceChannelId })
    if (!sourceChannel) {
        logger.info('Channel is not in database, scraping video ids')
        let sourceVideoIds = await getVideos(sourceChannelId, youtube)
        sourceVideoIds = sourceVideoIds.reverse() // reverse so the new ones are last
        await channelsCollection.insertOne({
            id: sourceChannelId,
            sourceVideoIds,
            processedSourceVideoIds: [],
        })
        sourceChannel = await channelsCollection.findOne<SourceChannel>({ id: sourceChannelId })
    }

    // clearing up assets folder
    await fs.rm(assetsDir, { recursive: true, force: true })
    await fs.mkdir(assetsDir)
    await fs.writeFile(join(assetsDir, '.gitkeep'), '')

    logger.info('Start processing videos')
    for (const id of sourceChannel.sourceVideoIds) {
        if (sourceChannel.processedSourceVideoIds.includes(id)) continue
        let success: boolean
        do {
            success = await processVideo(id, targetLang, youtube, yt)
            if (success) {
                logger.info(`Processed https://youtube.com/${id}`)
                channelsCollection.updateOne(
                    { id: sourceChannelId },
                    { $push: { processedSourceVideoIds: id } }
                )
            } else {
                const waitTime = 40 * 60 * 1000
                logger.info(`Reached upload limit or some bullshit.\nWaiting ${waitTime / 60000} minutes before retrying again`)
                await wait(waitTime)
            }
        } while (!success)
    }
    log('Done')
} finally {
    await client.close()
}
