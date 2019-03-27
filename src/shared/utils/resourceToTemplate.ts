import _ from 'lodash'
import {getDeep} from 'src/utils/wrappers'
import {Task, Label, Dashboard, Cell, View} from 'src/types'
import {
  TemplateType,
  DocumentCreate,
  ITemplate,
  Variable,
} from '@influxdata/influx'
import {viewableLabels} from 'src/labels/selectors'

const CURRENT_TEMPLATE_VERSION = '1'

const blankTemplate = () => ({
  meta: {version: CURRENT_TEMPLATE_VERSION},
  content: {data: {}, included: []},
  labels: [],
})

const blankTaskTemplate = () => {
  const baseTemplate = blankTemplate()
  return {
    ...baseTemplate,
    content: {
      ...baseTemplate.content,
      data: {...baseTemplate.content.data, type: TemplateType.Task},
    },
    labels: [],
  }
}

const blankVariableTemplate = () => {
  const baseTemplate = blankTemplate()
  return {
    ...baseTemplate,
    content: {
      ...baseTemplate.content,
      data: {...baseTemplate.content.data, type: TemplateType.Variable},
    },
    labels: [],
  }
}

const blankDashboardTemplate = () => {
  const baseTemplate = blankTemplate()
  return {
    ...baseTemplate,
    content: {
      ...baseTemplate.content,
      data: {...baseTemplate.content.data, type: TemplateType.Dashboard},
    },
    labels: [],
  }
}

export const labelToRelationship = (l: Label) => {
  return {type: TemplateType.Label, id: l.id}
}

export const labelToIncluded = (l: Label) => {
  return {
    type: TemplateType.Label,
    id: l.id,
    attributes: {
      name: l.name,
      properties: l.properties,
    },
  }
}

export const taskToTemplate = (
  task: Task,
  baseTemplate = blankTaskTemplate()
): DocumentCreate => {
  const taskName = _.get(task, 'name', '')
  const templateName = `${taskName}-Template`

  const taskAttributes = _.pick(task, [
    'status',
    'name',
    'flux',
    'every',
    'cron',
    'offset',
  ])

  const labels = viewableLabels(task.labels)
  const includedLabels = labels.map(l => labelToIncluded(l))
  const relationshipsLabels = labels.map(l => labelToRelationship(l))

  const template = {
    ...baseTemplate,
    meta: {
      ...baseTemplate.meta,
      name: templateName,
      description: `template created from task: ${taskName}`,
    },
    content: {
      ...baseTemplate.content,
      data: {
        ...baseTemplate.content.data,
        type: TemplateType.Task,
        attributes: taskAttributes,
        relationships: {
          [TemplateType.Label]: {data: relationshipsLabels},
        },
      },
      included: [...baseTemplate.content.included, ...includedLabels],
    },
  }

  return template
}

const viewToIncluded = (view: View) => {
  const viewAttributes = _.pick(view, ['properties', 'name'])

  return {
    type: TemplateType.View,
    id: view.id,
    attributes: viewAttributes,
  }
}

const viewToRelationship = (view: View) => ({
  type: TemplateType.View,
  id: view.id,
})

const cellToIncluded = (cell: Cell, views: View[]) => {
  const cellView = views.find(v => v.id === cell.id)
  const viewRelationship = viewToRelationship(cellView)

  const cellAttributes = _.pick(cell, ['x', 'y', 'w', 'h'])

  return {
    id: cell.id,
    type: TemplateType.Cell,
    attributes: cellAttributes,
    relationships: {
      [TemplateType.View]: {
        data: viewRelationship,
      },
    },
  }
}

const cellToRelationship = (cell: Cell) => ({
  type: TemplateType.Cell,
  id: cell.id,
})

export const variableToTemplate = (
  v: Variable,
  baseTemplate = blankVariableTemplate()
) => {
  const variableName = _.get(v, 'name', '')
  const templateName = `${variableName}-Template`
  const variableData = variableToIncluded(v)

  return {
    ...baseTemplate,
    meta: {
      ...baseTemplate.meta,
      name: templateName,
      description: `template created from variable: ${variableName}`,
    },
    content: {
      ...baseTemplate.content,
      data: {
        ...baseTemplate.content.data,
        ...variableData,
        relationships: {},
      },
      included: [],
    },
  }
}

const variableToIncluded = (v: Variable) => {
  const variableAttributes = _.pick(v, ['name', 'arguments', 'selected'])
  return {
    id: v.id,
    type: TemplateType.Variable,
    attributes: variableAttributes,
  }
}

const variableToRelationship = (v: Variable) => ({
  type: TemplateType.Variable,
  id: v.id,
})

export const dashboardToTemplate = (
  dashboard: Dashboard,
  views: View[],
  variables: Variable[],
  baseTemplate = blankDashboardTemplate()
): DocumentCreate => {
  const dashboardName = _.get(dashboard, 'name', '')
  const templateName = `${dashboardName}-Template`

  const dashboardAttributes = _.pick(dashboard, ['name', 'description'])

  const labels = getDeep<Label[]>(dashboard, 'labels', [])
  const includedLabels = labels.map(l => labelToIncluded(l))
  const relationshipsLabels = labels.map(l => labelToRelationship(l))

  const cells = getDeep<Cell[]>(dashboard, 'cells', [])
  const includedCells = cells.map(c => cellToIncluded(c, views))
  const relationshipsCells = cells.map(c => cellToRelationship(c))

  const includedVariables = variables.map(v => variableToIncluded(v))
  const relationshipsVariables = variables.map(v => variableToRelationship(v))

  const includedViews = views.map(v => viewToIncluded(v))

  const template = {
    ...baseTemplate,
    meta: {
      ...baseTemplate.meta,
      name: templateName,
      description: `template created from dashboard: ${dashboardName}`,
    },
    content: {
      ...baseTemplate.content,
      data: {
        ...baseTemplate.content.data,
        type: TemplateType.Dashboard,
        attributes: dashboardAttributes,
        relationships: {
          [TemplateType.Label]: {data: relationshipsLabels},
          [TemplateType.Cell]: {data: relationshipsCells},
          [TemplateType.Variable]: {data: relationshipsVariables},
        },
      },
      included: [
        ...baseTemplate.content.included,
        ...includedLabels,
        ...includedCells,
        ...includedViews,
        ...includedVariables,
      ],
    },
  }

  return template
}

export const templateToExport = (template: ITemplate): DocumentCreate => {
  const pickedTemplate = _.pick(template, ['meta', 'content'])
  const labelsArray = template.labels.map(l => l.name)
  const templateWithLabels = {...pickedTemplate, labels: labelsArray}
  return templateWithLabels
}

export const addOrgIDToTemplate = (
  template: DocumentCreate,
  orgID: string
): DocumentCreate => {
  return {...template, orgID}
}
