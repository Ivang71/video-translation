// YouTube API video uploader using JavaScript/Node.js
// You can find the full visual guide at: https://www.youtube.com/watch?v=gncPwSEzq1s
// You can find the brief written guide at: https://quanticdev.com/articles/automating-my-youtube-uploads-using-nodejs
//
// Upload code is adapted from: https://developers.google.com/youtube/v3/quickstart/nodejs

import * as fs from 'fs'
import readline from 'readline'
import assert from 'assert'
import { google, youtube_v3 } from 'googleapis'
import { dirname, join } from 'path'
import { credsDir } from './paths.ts'
import { Credentials, OAuth2Client } from 'google-auth-library'
import { GaxiosResponse } from 'gaxios'
import { log } from 'console'

const OAuth2 = google.auth.OAuth2

// If modifying these scopes, delete your previously saved credentials in client_oauth_token.json
const SCOPES = ['https://www.googleapis.com/auth/youtube.upload']
const TOKEN_PATH = join(credsDir, 'client-oauth-token.json')
const CLIENT_SECRET = join(credsDir, 'client-secret.json')

  
type ClientSecret = {
    installed: {
        client_id: string
        project_id: string
        auth_uri: string
        token_uri: string
        auth_provider_x509_cert_url: string
        client_secret: string
        redirect_uris: string[]
    }
}

interface UploadParams {
    dirName: string
    title: string
    desc: string
    tags: string[]
    categoryId: string
    lang: string
}

export const uploadVideo = (p: UploadParams) => {
    fs.readFile(CLIENT_SECRET, (err, content) => {
        if (err) {
            console.log('Error loading client secret file: ' + err)
            return
        }
        authorize(JSON.parse(content.toString()), (auth: ClientSecret) =>
            upload({...p, auth})
        )
    })
}

function upload(p: UploadParams & { auth: any }) {
    const service = google.youtube('v3')
log(p)
    // service.videos.insert(
    //     {
    //         auth: p.auth,
    //         part: ['snippet', 'status'],
    //         requestBody: {
    //             snippet: {
    //                 title: p.title,
    //                 description: p.desc,
    //                 tags: p.tags,
    //                 categoryId: p.categoryId,
    //                 defaultLanguage: p.lang,
    //                 defaultAudioLanguage: p.lang,
    //                 thumbnails: {
    //                     maxres: {
    //                         url: join(p.dirName, 'thumb.jpg')
    //                     }
    //                 }
    //             },
    //             status: {
    //                 privacyStatus: 'public',
    //             },
    //         },
    //         media: {
    //             body: fs.createReadStream(join(p.dirName, 'video.mp4')),
    //         },
    //     },
    //     (err: Error | null, response: GaxiosResponse<youtube_v3.Schema$Video> | null) => {
    //         if (err) {
    //             console.log('The API returned an error: ' + err)
    //             return
    //         }
    //         console.log(response.data)
    //         console.log('Video uploaded.')
    //     }
    // )
}

function authorize(credentials: ClientSecret, callback: Function) {
    const clientSecret = credentials.installed.client_secret
    const clientId = credentials.installed.client_id
    const redirectUrl = credentials.installed.redirect_uris[0]
    const oauth2Client = new OAuth2(clientId, clientSecret, redirectUrl)

    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) {
            getNewToken(oauth2Client, callback)
        } else {
            // oauth2Client.setCredentials({access_token: JSON.parse(token.toString())})
            oauth2Client.credentials = JSON.parse(token.toString())
            callback(oauth2Client)
        }
    })
}

function getNewToken(oauth2Client: OAuth2Client, callback: Function) {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    })
    console.log('Authorize this app by visiting this url: ', authUrl)
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    })
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close()
        oauth2Client.getToken(code, (err, token) => {
            if (err) {
                console.log('Error while trying to retrieve access token', err)
                return
            }
            // oauth2Client.setCredentials({access_token: JSON.parse(token.toString())})
            oauth2Client.credentials = token
            storeToken(token)
            callback(oauth2Client)
        })
    })
}

function storeToken(token: Credentials) {
    fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) throw err
        console.log('Token stored to ' + TOKEN_PATH)
    })
}
