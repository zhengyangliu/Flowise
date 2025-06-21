import { INodeCredential, INodeParams } from '../src/Interface'

class VolcengineApi implements INodeCredential {
    label: string
    name: string
    version: number
    description: string
    inputs: INodeParams[]

    constructor() {
        this.label = 'Volcengine API'
        this.name = 'volcengineApi'
        this.version = 1.0
        this.description =
            'Refer to <a target="_blank" href="https://www.volcengine.com/docs/82379/1541594">official guide</a> on how to get API key on Volcengine'
        this.inputs = [
            {
                label: 'Volcengine API Key',
                name: 'volcengineApiKey',
                type: 'password'
            }
        ]
    }
}

module.exports = { credClass: VolcengineApi }
