import { chromium } from 'playwright'
import { newInjectedContext } from 'fingerprint-injector'
import { join } from 'path'
import { randint } from '../utils/index.ts'


export const translateImage = async (imageUrl: string, targetLang: string, saveDir: string) => {
    const browser = await chromium.launch({ headless: true })
    const context = await newInjectedContext(browser, {
        fingerprintOptions: { devices: ['desktop'], screen: { maxWidth: 1980 }},
        newContextOptions: {
            locale: 'US',
            permissions: [ 'clipboard-read' ]
        }
    })

    const page = await context.newPage()
    const downloadPromise = page.waitForEvent('download');

    await page.goto(imageUrl)
    await page.waitForLoadState('networkidle')
    await page.keyboard.press(`Control+C`)

    await page.goto(`https://translate.google.com/?sl=auto&tl=${targetLang}&op=images`)
    await page.waitForTimeout(randint(993, 1493))

    const mockButton = await page.$('button[jsname="dq27Te"]')
    await mockButton.click()
    await page.waitForTimeout(randint(432, 2874))
    await mockButton.click()
    await page.waitForTimeout(randint(421, 623))

    const pasteButton = await page.$('span:has-text("Paste from clipboard")')
    await pasteButton.click()
    await page.waitForTimeout(randint(6783, 7529))
    const image = (await page.$$('img[loading]'))[1]
    const url = await image.getAttribute('src')
    let alt = (await image.getAttribute('alt')).replace(/\n/g, ' ')

    await Promise.all([
      page.waitForEvent('download'),
      page.evaluate(({url, alt}) => {
        console.log('Browser ', url, alt)
        const a = document.createElement('a')
        a.href = url
        a.download = alt + '.jpg'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }, {url, alt}),
    ])

    const download = await downloadPromise
    const imagePath = join(saveDir, 'thumb.jpg')
    await download.saveAs(imagePath)
    browser.close()
}
