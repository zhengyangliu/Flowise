import { getBaseClasses, INode, INodeData, INodeParams } from '../../../src'
import { BaseOutputParser } from '@langchain/core/output_parsers'
import { StructuredOutputParser as LangchainStructuredOutputParser } from 'langchain/output_parsers'
import { CATEGORY } from '../OutputParserHelpers'
import { z } from 'zod'
import { jsonrepair } from 'jsonrepair'

/**
 * StructuredOutputParserAdvancedUI
 * Visual interface for building structured output schemas
 */
class StructuredOutputParserAdvancedUI implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    category: string
    baseClasses: string[]
    inputs: INodeParams[]
    credential: INodeParams

    constructor() {
        this.label = 'Structured Output Parser Advanced UI'
        this.name = 'structuredOutputParserAdvancedUI'
        this.version = 1.0
        this.type = 'StructuredOutputParserAdvancedUI'
        this.description = 'Build structured output schemas with a visual interface instead of writing Zod code.'
        this.icon = 'structure.svg'
        this.category = CATEGORY
        this.baseClasses = [this.type, ...getBaseClasses(BaseOutputParser)]
        this.inputs = [
            {
                label: 'Autofix',
                name: 'autofixParser',
                type: 'boolean',
                optional: true,
                description: 'In the event that the first call fails, will make another call to the model to fix any errors.'
            },
            {
                label: 'Schema Builder',
                name: 'schemaBuilder',
                type: 'zodSchema',
                description: 'Visual interface to build and manage structured output schema',
                default: [
                    {
                        id: 1,
                        fieldName: 'title',
                        fieldType: 'string',
                        description: 'Title of the content',
                        required: true,
                        validation: {}
                    },
                    {
                        id: 2,
                        fieldName: 'description',
                        fieldType: 'string',
                        description: 'Description of the content',
                        required: false,
                        validation: {
                            maxLength: 500
                        }
                    }
                ],
                additionalParams: true,
                requiresLargeDialog: true
            },
            {
                label: 'Generated Schema Preview',
                name: 'generatedSchema',
                type: 'string',
                description: 'Preview of the generated Zod schema (read-only)',
                rows: 10,
                placeholder: 'Generated Zod schema will appear here...',
                optional: true
            }
        ]
    }

    async init(nodeData: INodeData): Promise<any> {
        const schemaBuilder = nodeData.inputs?.schemaBuilder as string
        const autoFix = nodeData.inputs?.autofixParser as boolean

        try {
            const schemaConfig = typeof schemaBuilder === 'string' ? JSON.parse(schemaBuilder) : schemaBuilder
            const zodSchema = this.convertUIConfigToZodSchema(schemaConfig)
            const structuredOutputParser = LangchainStructuredOutputParser.fromZodSchema(zodSchema)

            const baseParse = structuredOutputParser.parse

            structuredOutputParser.parse = (text) => {
                const jsonString = text.includes('```') ? text.trim().split(/```(?:json)?/)[1] : text.trim()
                return baseParse.call(structuredOutputParser, jsonrepair(jsonString))
            }

            Object.defineProperty(structuredOutputParser, 'autoFix', {
                enumerable: true,
                configurable: true,
                writable: true,
                value: autoFix
            })

            return structuredOutputParser
        } catch (exception) {
            throw new Error('Error creating structured output schema from UI configuration: ' + exception)
        }
    }

    private convertUIConfigToZodSchema(schemaConfig: any[]): z.ZodObject<any> {
        const rootFields = schemaConfig.filter((field) => !field.parentId)
        return this.createObjectFromFields(rootFields, schemaConfig)
    }

    private createObjectFromFields(fieldsToProcess: any[], allFields: any[]): z.ZodObject<any> {
        const zodObj: Record<string, any> = {}

        for (const field of fieldsToProcess) {
            let zodField = this.createZodFieldFromConfig(field, allFields)

            if (!field.required) {
                zodField = zodField.optional()
            }

            if (field.description) {
                zodField = zodField.describe(field.description)
            }

            zodObj[field.fieldName] = zodField
        }

        return z.object(zodObj)
    }

    private createZodFieldFromConfig(field: any, allFields: any[]): any {
        const { fieldType, validation = {} } = field
        const childFields = allFields.filter((f) => f.parentId === field.id)

        switch (fieldType) {
            case 'string': {
                let stringSchema = z.string()
                if (validation.minLength) stringSchema = stringSchema.min(validation.minLength)
                if (validation.maxLength) stringSchema = stringSchema.max(validation.maxLength)
                if (validation.pattern) stringSchema = stringSchema.regex(new RegExp(validation.pattern))
                if (validation.email) stringSchema = z.string().email()
                if (validation.url) stringSchema = z.string().url()
                return stringSchema
            }

            case 'number': {
                let numberSchema = z.number()
                if (validation.min !== undefined) numberSchema = numberSchema.min(validation.min)
                if (validation.max !== undefined) numberSchema = numberSchema.max(validation.max)
                if (validation.integer) numberSchema = numberSchema.int()
                return numberSchema
            }

            case 'boolean':
                return z.boolean()

            case 'array': {
                if (childFields.length > 0) {
                    const itemSchema = this.createObjectFromFields(childFields, allFields)
                    let arraySchema = z.array(itemSchema)
                    if (validation.minItems) arraySchema = arraySchema.min(validation.minItems)
                    if (validation.maxItems) arraySchema = arraySchema.max(validation.maxItems)
                    return arraySchema
                } else {
                    const itemType = validation.itemType || 'string'
                    const itemSchema = this.createZodFieldFromConfig(
                        { fieldType: itemType, validation: validation.itemValidation || {} },
                        allFields
                    )
                    let arraySchema = z.array(itemSchema)
                    if (validation.minItems) arraySchema = arraySchema.min(validation.minItems)
                    if (validation.maxItems) arraySchema = arraySchema.max(validation.maxItems)
                    return arraySchema
                }
            }

            case 'enum': {
                if (validation.enumValues && validation.enumValues.length > 0) {
                    return z.enum(validation.enumValues)
                }
                return z.string()
            }

            case 'object': {
                if (childFields.length > 0) {
                    return this.createObjectFromFields(childFields, allFields)
                } else {
                    return z.object({})
                }
            }

            case 'date':
                return z.date()

            case 'literal': {
                if (validation.value !== undefined) {
                    return z.literal(validation.value)
                }
                return z.string()
            }

            default:
                return z.string()
        }
    }
}

module.exports = { nodeClass: StructuredOutputParserAdvancedUI }
