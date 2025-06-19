import PropTypes from 'prop-types'
import { useState, useEffect } from 'react'
import {
    Box,
    Button,
    Card,
    CardContent,
    FormControl,
    Grid,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Switch,
    TextField,
    Typography,
    Divider,
    Popover
} from '@mui/material'
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    Code as CodeIcon,
    Settings as SettingsIcon,
    AccountTree as ObjectIcon,
    ViewList as ArrayIcon,
    Description as DescriptionIcon
} from '@mui/icons-material'

const FIELD_TYPES = [
    { value: 'string', label: 'String' },
    { value: 'number', label: 'Number' },
    { value: 'boolean', label: 'Boolean' },
    { value: 'array', label: 'Array' },
    { value: 'object', label: 'Object' },
    { value: 'enum', label: 'Enum' },
    { value: 'date', label: 'Date' },
    { value: 'literal', label: 'Literal' }
]

const STRING_VALIDATIONS = ['minLength', 'maxLength', 'pattern', 'email', 'url']
const NUMBER_VALIDATIONS = ['min', 'max', 'integer']
const ARRAY_VALIDATIONS = ['minItems', 'maxItems', 'itemType']
const ENUM_VALIDATIONS = ['enumValues']

export const ZodSchema = ({ value, onChange, disabled = false }) => {
    const [fields, setFields] = useState([])
    const [generatedSchema, setGeneratedSchema] = useState('')
    const [globalExpanded, setGlobalExpanded] = useState(true)

    useEffect(() => {
        try {
            const parsedValue = typeof value === 'string' ? JSON.parse(value) : value
            if (Array.isArray(parsedValue)) {
                // Ensure all fields have complete properties
                const normalizeField = (field) => ({
                    id: field.id || Date.now() + Math.random(),
                    fieldName: field.fieldName || '',
                    fieldType: field.fieldType || 'string',
                    description: field.description || '',
                    required: field.required !== undefined ? field.required : true,
                    validation: field.validation || {},
                    children: field.children ? field.children.map(normalizeField) : []
                })

                const fieldsWithChildren = parsedValue.map(normalizeField)
                setFields(fieldsWithChildren)
            } else {
                // Initialize with empty array if no valid data
                setFields([])
            }
        } catch (error) {
            console.error('Error parsing schema value:', error)
            setFields([])
        }
    }, [value])

    useEffect(() => {
        generateSchemaPreview()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fields])

    const generateSchemaPreview = () => {
        try {
            const schemaLines = ['z.object({']

            fields.forEach((field, index) => {
                const indent = '    '
                let fieldDef = `${indent}${field.fieldName}: `

                // Generate field type
                fieldDef += generateFieldTypeCode(field)

                // Add description
                if (field.description) {
                    fieldDef += `.describe('${field.description}')`
                }

                // Add optional
                if (!field.required) {
                    fieldDef += '.optional()'
                }

                // Add comma except for last item
                if (index < fields.length - 1) {
                    fieldDef += ','
                }

                schemaLines.push(fieldDef)
            })

            schemaLines.push('})')
            setGeneratedSchema(schemaLines.join('\n'))
        } catch (error) {
            setGeneratedSchema('// Error generating schema preview')
        }
    }

    const generateFieldTypeCode = (field) => {
        const { fieldType, validation = {} } = field

        switch (fieldType) {
            case 'string': {
                let stringCode = 'z.string()'
                if (validation.minLength) stringCode += `.min(${validation.minLength})`
                if (validation.maxLength) stringCode += `.max(${validation.maxLength})`
                if (validation.pattern) stringCode += `.regex(/${validation.pattern}/)`
                if (validation.email) stringCode = 'z.string().email()'
                if (validation.url) stringCode = 'z.string().url()'
                return stringCode
            }

            case 'number': {
                let numberCode = 'z.number()'
                if (validation.min !== undefined) numberCode += `.min(${validation.min})`
                if (validation.max !== undefined) numberCode += `.max(${validation.max})`
                if (validation.integer) numberCode += '.int()'
                return numberCode
            }

            case 'boolean':
                return 'z.boolean()'

            case 'array': {
                let arrayCode
                if (field.children && field.children.length > 0) {
                    // Use nested schema for array items
                    const childSchema = generateNestedObjectCode(field.children)
                    arrayCode = `z.array(${childSchema})`
                } else {
                    // Use simple item type
                    const itemType = validation.itemType || 'string'
                    arrayCode = `z.array(z.${itemType}())`
                }
                if (validation.minItems) arrayCode += `.min(${validation.minItems})`
                if (validation.maxItems) arrayCode += `.max(${validation.maxItems})`
                return arrayCode
            }

            case 'enum':
                if (validation.enumValues && validation.enumValues.length > 0) {
                    const enumValues = validation.enumValues.map((v) => `'${v}'`).join(', ')
                    return `z.enum([${enumValues}])`
                }
                return 'z.string()'

            case 'object':
                if (field.children && field.children.length > 0) {
                    return generateNestedObjectCode(field.children)
                }
                return 'z.object({})'

            case 'date':
                return 'z.date()'

            case 'literal':
                if (validation.value !== undefined) {
                    return `z.literal('${validation.value}')`
                }
                return 'z.string()'

            default:
                return 'z.string()'
        }
    }

    const generateNestedObjectCode = (children) => {
        if (!children || children.length === 0) {
            return 'z.object({})'
        }

        const properties = children
            .filter((child) => child.fieldName)
            .map((child) => {
                const childCode = generateFieldTypeCode(child)
                const optional = child.required ? '' : '.optional()'
                const description = child.description ? `.describe('${child.description}')` : ''
                return `${child.fieldName}: ${childCode}${optional}${description}`
            })

        return `z.object({\n      ${properties.join(',\n      ')}\n    })`
    }

    const addField = (parentId = null) => {
        const newField = {
            id: Date.now(),
            fieldName: `field_${Date.now()}`,
            fieldType: 'string',
            description: '',
            required: true,
            validation: {},
            children: []
        }

        let updatedFields
        if (parentId) {
            updatedFields = addChildField(fields, parentId, newField)
        } else {
            updatedFields = [...fields, newField]
        }

        setFields(updatedFields)
        onChange(JSON.stringify(updatedFields))
    }

    const addChildField = (fieldsArray, parentId, newField) => {
        return fieldsArray.map((field) => {
            if (field.id === parentId) {
                return { ...field, children: [...(field.children || []), newField] }
            } else if (field.children && field.children.length > 0) {
                return { ...field, children: addChildField(field.children, parentId, newField) }
            }
            return field
        })
    }

    const removeField = (id) => {
        const updatedFields = removeFieldRecursive(fields, id)
        setFields(updatedFields)
        onChange(JSON.stringify(updatedFields))
    }

    const removeFieldRecursive = (fieldsArray, id) => {
        return fieldsArray
            .filter((field) => field.id !== id)
            .map((field) => ({
                ...field,
                children: field.children ? removeFieldRecursive(field.children, id) : []
            }))
    }

    const updateField = (id, updates) => {
        const updatedFields = updateFieldRecursive(fields, id, updates)
        setFields(updatedFields)
        onChange(JSON.stringify(updatedFields))
    }

    const updateFieldRecursive = (fieldsArray, id, updates) => {
        return fieldsArray.map((field) => {
            if (field.id === id) {
                return { ...field, ...updates }
            } else if (field.children && field.children.length > 0) {
                return { ...field, children: updateFieldRecursive(field.children, id, updates) }
            }
            return field
        })
    }

    const updateValidation = (id, validationKey, validationValue) => {
        const updatedFields = updateValidationRecursive(fields, id, validationKey, validationValue)
        setFields(updatedFields)
        onChange(JSON.stringify(updatedFields))
    }

    const updateValidationRecursive = (fieldsArray, id, validationKey, validationValue) => {
        return fieldsArray.map((field) => {
            if (field.id === id) {
                const newValidation = { ...field.validation }
                if (validationValue === '' || validationValue === null || validationValue === undefined) {
                    delete newValidation[validationKey]
                } else {
                    newValidation[validationKey] = validationValue
                }
                return { ...field, validation: newValidation }
            } else if (field.children && field.children.length > 0) {
                return { ...field, children: updateValidationRecursive(field.children, id, validationKey, validationValue) }
            }
            return field
        })
    }

    const toggleExpandAll = () => {
        setGlobalExpanded(!globalExpanded)
    }

    return (
        <Box sx={{ width: '100%' }}>
            <Stack direction='row' justifyContent='space-between' alignItems='center' sx={{ mb: 2 }}>
                <Typography variant='h6'>Schema Fields</Typography>
                <Stack direction='row' spacing={1}>
                    <Button
                        variant='text'
                        onClick={toggleExpandAll}
                        disabled={disabled}
                        size='small'
                        sx={{ minWidth: 'auto', px: 1 }}
                        startIcon={
                            <Box
                                sx={{
                                    fontSize: '14px',
                                    lineHeight: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transform: globalExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.2s ease'
                                }}
                            >
                                ▶
                            </Box>
                        }
                    >
                        {globalExpanded ? 'Collapse All' : 'Expand All'}
                    </Button>
                    <Button variant='outlined' startIcon={<AddIcon />} onClick={() => addField()} disabled={disabled} size='small'>
                        Add Field
                    </Button>
                </Stack>
            </Stack>

            {fields.map((field) => (
                <FieldRenderer
                    key={field.id}
                    field={field}
                    level={0}
                    onUpdateField={updateField}
                    onUpdateValidation={updateValidation}
                    onRemoveField={removeField}
                    onAddField={addField}
                    disabled={disabled}
                    globalExpanded={globalExpanded}
                />
            ))}

            {fields.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant='body2' color='text.secondary'>
                        No fields defined. Click &quot;Add Field&quot; to start building your schema.
                    </Typography>
                </Box>
            )}

            <Divider sx={{ my: 3 }} />
            <Box sx={{ mt: 2 }}>
                <Stack direction='row' alignItems='center' spacing={1} sx={{ mb: 1 }}>
                    <CodeIcon fontSize='small' />
                    <Typography variant='h6'>Generated Schema Preview</Typography>
                </Stack>
                <Box
                    sx={{
                        p: 2,
                        borderRadius: 1,
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        whiteSpace: 'pre-wrap',
                        maxHeight: 300,
                        overflow: 'auto',
                        backgroundColor: 'textBackground.main',
                        border: 1,
                        borderColor: 'textBackground.border',
                        color: 'text.primary'
                    }}
                >
                    {generatedSchema || '// Schema will appear here...'}
                </Box>
            </Box>
        </Box>
    )
}

const ValidationRules = ({ field, onUpdateValidation, disabled }) => {
    const validationFields = getValidationFields(field.fieldType)

    const renderValidationField = (validationType) => {
        const value = field.validation[validationType] || ''

        switch (validationType) {
            case 'minLength':
            case 'maxLength':
            case 'min':
            case 'max':
            case 'minItems':
            case 'maxItems':
                return (
                    <TextField
                        key={validationType}
                        label={validationType}
                        type='number'
                        value={value}
                        onChange={(e) => onUpdateValidation(field.id, validationType, parseInt(e.target.value) || '')}
                        disabled={disabled}
                        size='small'
                        sx={{ mb: 1 }}
                    />
                )
            case 'pattern':
                return (
                    <TextField
                        key={validationType}
                        label='Regex Pattern'
                        value={value}
                        onChange={(e) => onUpdateValidation(field.id, validationType, e.target.value)}
                        disabled={disabled}
                        size='small'
                        sx={{ mb: 1 }}
                    />
                )
            case 'email':
            case 'url':
            case 'integer':
                return (
                    <Stack key={validationType} direction='row' alignItems='center' spacing={1} sx={{ mb: 1 }}>
                        <Typography variant='body2'>{validationType}</Typography>
                        <Switch
                            checked={!!value}
                            onChange={(e) => onUpdateValidation(field.id, validationType, e.target.checked)}
                            disabled={disabled}
                            size='small'
                        />
                    </Stack>
                )
            case 'itemType':
                return (
                    <FormControl key={validationType} size='small' sx={{ mb: 1, minWidth: 120 }}>
                        <InputLabel>Item Type</InputLabel>
                        <Select
                            value={value || 'string'}
                            label='Item Type'
                            onChange={(e) => onUpdateValidation(field.id, validationType, e.target.value)}
                            disabled={disabled}
                        >
                            <MenuItem value='string'>String</MenuItem>
                            <MenuItem value='number'>Number</MenuItem>
                            <MenuItem value='boolean'>Boolean</MenuItem>
                        </Select>
                    </FormControl>
                )
            case 'enumValues':
                return (
                    <TextField
                        key={validationType}
                        label='Enum Values (comma-separated)'
                        value={Array.isArray(value) ? value.join(', ') : value || ''}
                        onChange={(e) => {
                            const enumValues = e.target.value
                                .split(',')
                                .map((v) => v.trim())
                                .filter((v) => v)
                            onUpdateValidation(field.id, validationType, enumValues)
                        }}
                        disabled={disabled}
                        size='small'
                        sx={{ mb: 1 }}
                        placeholder='option1, option2, option3'
                        multiline
                        rows={2}
                    />
                )
            default:
                return null
        }
    }

    return (
        <Grid container spacing={2}>
            {validationFields.map((validationType) => (
                <Grid item xs={12} sm={6} md={4} key={validationType}>
                    {renderValidationField(validationType)}
                </Grid>
            ))}
        </Grid>
    )
}

const getValidationFields = (fieldType) => {
    switch (fieldType) {
        case 'string':
            return STRING_VALIDATIONS
        case 'number':
            return NUMBER_VALIDATIONS
        case 'array':
            return ARRAY_VALIDATIONS
        case 'enum':
            return ENUM_VALIDATIONS
        default:
            return []
    }
}

ZodSchema.propTypes = {
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
    onChange: PropTypes.func.isRequired,
    disabled: PropTypes.bool
}

ValidationRules.propTypes = {
    field: PropTypes.object.isRequired,
    onUpdateValidation: PropTypes.func.isRequired,
    disabled: PropTypes.bool
}

const FieldRenderer = ({ field, level, onUpdateField, onUpdateValidation, onRemoveField, onAddField, disabled, globalExpanded }) => {
    const canHaveChildren = field.fieldType === 'object' || field.fieldType === 'array'
    const hasChildren = field.children && field.children.length > 0
    const [isExpanded, setIsExpanded] = useState(true)

    // Sync with global expand/collapse state
    useEffect(() => {
        setIsExpanded(globalExpanded)
    }, [globalExpanded])

    // Get icon based on field type
    const getFieldIcon = () => {
        switch (field.fieldType) {
            case 'object':
                return <ObjectIcon fontSize='small' color='primary' />
            case 'array':
                return <ArrayIcon fontSize='small' color='secondary' />
            default:
                return <DescriptionIcon fontSize='small' color='action' />
        }
    }

    const handleAddChild = () => {
        setIsExpanded(true)
        onAddField(field.id)
    }
    const renderFieldContent = () => (
        <Grid container spacing={2} alignItems='center'>
            <Grid item xs={12} sm={4}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {hasChildren ? (
                        <IconButton
                            onClick={() => setIsExpanded(!isExpanded)}
                            disabled={disabled}
                            size='small'
                            title={isExpanded ? 'Collapse' : 'Expand'}
                            sx={{
                                color: 'info.main',
                                minWidth: 12,
                                width: 12,
                                height: 12
                            }}
                        >
                            <Box
                                sx={{
                                    fontSize: '14px',
                                    lineHeight: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.2s ease'
                                }}
                            >
                                ▶
                            </Box>
                        </IconButton>
                    ) : (
                        <Box sx={{ width: 12 }} />
                    )}
                    <TextField
                        fullWidth
                        label='Field Name'
                        value={field.fieldName}
                        onChange={(e) => onUpdateField(field.id, { fieldName: e.target.value })}
                        disabled={disabled}
                        size='small'
                    />
                </Box>
            </Grid>
            <Grid item xs={12} sm={2}>
                <FormControl fullWidth size='small'>
                    <InputLabel>Type</InputLabel>
                    <Select
                        value={field.fieldType || 'string'}
                        label='Type'
                        onChange={(e) => onUpdateField(field.id, { fieldType: e.target.value, validation: {}, children: [] })}
                        disabled={disabled}
                    >
                        {FIELD_TYPES.map((type) => (
                            <MenuItem key={type.value} value={type.value}>
                                {type.label}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Grid>
            <Grid item xs={12} sm={3.5}>
                <DescriptionEditor
                    value={field.description}
                    onChange={(value) => onUpdateField(field.id, { description: value })}
                    disabled={disabled}
                    fieldName={field.fieldName}
                />
            </Grid>
            <Grid item xs={12} sm={1.5}>
                <Stack direction='row' alignItems='center' spacing={0.5} sx={{ minWidth: 'fit-content' }}>
                    <Typography variant='body2' sx={{ fontSize: '0.75rem' }}>
                        Req
                    </Typography>
                    <Switch
                        checked={field.required}
                        onChange={(e) => onUpdateField(field.id, { required: e.target.checked })}
                        disabled={disabled}
                        size='small'
                    />
                </Stack>
            </Grid>
            <Grid item xs={12} sm={1}>
                <Stack direction='row' spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                    {getValidationFields(field.fieldType).length > 0 && (
                        <ValidationRulesIcon field={field} onUpdateValidation={onUpdateValidation} disabled={disabled} />
                    )}
                    {canHaveChildren && (
                        <IconButton
                            onClick={handleAddChild}
                            disabled={disabled}
                            size='small'
                            title={`Add ${field.fieldType === 'array' ? 'item type' : 'property'}`}
                            sx={{ color: 'primary.main' }}
                        >
                            <AddIcon />
                        </IconButton>
                    )}
                    <IconButton
                        onClick={() => onRemoveField(field.id)}
                        disabled={disabled}
                        size='small'
                        sx={{
                            color: 'text.secondary'
                        }}
                    >
                        <DeleteIcon />
                    </IconButton>
                </Stack>
            </Grid>
        </Grid>
    )

    return (
        <Box sx={{ mb: 1 }}>
            <Card
                sx={{
                    backgroundColor: level > 0 ? 'background.default' : 'background.paper',
                    border: 1,
                    borderRight: level > 0 ? 0 : 0.5,
                    borderColor: level > 0 ? 'textBackground.border' : 'divider',
                    borderRadius: 2
                }}
            >
                <CardContent sx={{ pl: 2, py: 1.5, '&:last-child': { pb: hasChildren && isExpanded ? 1.5 : 1.5 } }}>
                    {renderFieldContent()}
                </CardContent>

                {hasChildren && isExpanded && (
                    <Box
                        sx={{
                            mx: 2,
                            mb: 2,
                            mr: 0,
                            border: 0,
                            borderColor: 'textBackground.border',
                            borderRadius: 2,
                            borderRight: 0,
                            p: 2,
                            pr: 0,
                            backgroundColor: 'textBackground.main'
                        }}
                    >
                        <Typography variant='body2' color='text.secondary' sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                            {getFieldIcon()}
                            {field.fieldType === 'array' ? 'Array Items:' : 'Object Properties:'}
                        </Typography>
                        {field.children.map((childField) => (
                            <FieldRenderer
                                key={childField.id}
                                field={childField}
                                level={level + 1}
                                onUpdateField={onUpdateField}
                                onUpdateValidation={onUpdateValidation}
                                onRemoveField={onRemoveField}
                                onAddField={onAddField}
                                disabled={disabled}
                                globalExpanded={globalExpanded}
                            />
                        ))}
                    </Box>
                )}
            </Card>
        </Box>
    )
}

FieldRenderer.propTypes = {
    field: PropTypes.object.isRequired,
    level: PropTypes.number.isRequired,
    onUpdateField: PropTypes.func.isRequired,
    onUpdateValidation: PropTypes.func.isRequired,
    onRemoveField: PropTypes.func.isRequired,
    onAddField: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
    globalExpanded: PropTypes.bool.isRequired
}

const ValidationRulesIcon = ({ field, onUpdateValidation, disabled }) => {
    const [open, setOpen] = useState(false)
    const [anchorEl, setAnchorEl] = useState(null)

    const handleClick = (event) => {
        setAnchorEl(event.currentTarget)
        setOpen(true)
    }

    const handleClose = () => {
        setOpen(false)
        setAnchorEl(null)
    }

    return (
        <>
            <IconButton
                onClick={handleClick}
                disabled={disabled}
                size='small'
                title='Validation Rules'
                sx={{
                    color: 'primary.main'
                }}
            >
                <SettingsIcon />
            </IconButton>
            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left'
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left'
                }}
            >
                <Box sx={{ p: 2, minWidth: 300 }}>
                    <Typography variant='subtitle2' sx={{ mb: 2 }}>
                        Validation Rules for {field.fieldName || 'Field'}
                    </Typography>
                    <ValidationRules field={field} onUpdateValidation={onUpdateValidation} disabled={disabled} />
                </Box>
            </Popover>
        </>
    )
}

ValidationRulesIcon.propTypes = {
    field: PropTypes.object.isRequired,
    onUpdateValidation: PropTypes.func.isRequired,
    disabled: PropTypes.bool
}

const DescriptionEditor = ({ value, onChange, disabled, fieldName }) => {
    const [open, setOpen] = useState(false)
    const [anchorEl, setAnchorEl] = useState(null)
    const [tempValue, setTempValue] = useState(value || '')

    const handleClick = (event) => {
        setAnchorEl(event.currentTarget)
        setTempValue(value || '')
        setOpen(true)
    }

    const handleClose = () => {
        setOpen(false)
        setAnchorEl(null)
    }

    const handleSave = () => {
        onChange(tempValue)
        handleClose()
    }

    const handleCancel = () => {
        setTempValue(value || '')
        handleClose()
    }

    return (
        <>
            <TextField
                fullWidth
                label='Description'
                value={value || ''}
                onClick={handleClick}
                disabled={disabled}
                size='small'
                placeholder='Click to edit description...'
                InputProps={{
                    readOnly: true,
                    style: { cursor: disabled ? 'default' : 'pointer' }
                }}
                sx={{
                    '& .MuiInputBase-input': {
                        cursor: disabled ? 'default' : 'pointer'
                    }
                }}
            />
            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleCancel}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left'
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left'
                }}
            >
                <Box sx={{ p: 3, minWidth: 400, maxWidth: 600 }}>
                    <Typography variant='subtitle2' sx={{ mb: 2 }}>
                        Edit Description for {fieldName || 'Field'}
                    </Typography>
                    <TextField
                        fullWidth
                        multiline
                        rows={4}
                        label='Description'
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        placeholder='Enter a detailed description for this field...'
                        sx={{ mb: 2 }}
                    />
                    <Stack direction='row' spacing={2} justifyContent='flex-end'>
                        <Button variant='outlined' onClick={handleCancel}>
                            Cancel
                        </Button>
                        <Button variant='contained' onClick={handleSave}>
                            Save
                        </Button>
                    </Stack>
                </Box>
            </Popover>
        </>
    )
}

DescriptionEditor.propTypes = {
    value: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
    fieldName: PropTypes.string
}
