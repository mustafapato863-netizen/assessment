targetScope = 'resourceGroup'

@description('Azure region approved for the environment.')
param location string = resourceGroup().location

@description('Short environment name, for example assessflow-dev.')
param environmentName string

@description('Container image that serves the same-origin React/API application.')
param webApiImage string

@description('Private worker image for background jobs.')
param workerImage string

@description('PostgreSQL administrator login. Use a deployment secret reference in CI.')
param postgresAdminLogin string

@secure()
@description('PostgreSQL administrator password. Never commit this value.')
param postgresAdminPassword string

@description('Whether the environment is production-sized and zone redundant.')
param production bool = false

var namePrefix = replace(toLower(environmentName), '_', '-')
var logWorkspaceName = '${namePrefix}-logs'
var containerEnvironmentName = '${namePrefix}-aca'
var webApiName = '${namePrefix}-web-api'
var workerName = '${namePrefix}-worker'
var postgresName = '${namePrefix}-postgres'
var storageName = take(replace('${namePrefix}files', '-', ''), 24)
var keyVaultName = take('${namePrefix}-kv', 24)

resource logWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logWorkspaceName
  location: location
  properties: {
    retentionInDays: production ? 90 : 30
    sku: {
      name: 'PerGB2018'
    }
  }
}

resource containerEnvironment 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: containerEnvironmentName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logWorkspace.properties.customerId
        sharedKey: logWorkspace.listKeys().primarySharedKey
      }
    }
    zoneRedundant: production
  }
}

resource webApi 'Microsoft.App/containerApps@2023-05-01' = {
  name: webApiName
  location: location
  properties: {
    managedEnvironmentId: containerEnvironment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
        transport: 'http'
        allowInsecure: false
      }
      activeRevisionsMode: 'Multiple'
    }
    template: {
      containers: [
        {
          name: 'web-api'
          image: webApiImage
          env: [
            {
              name: 'NODE_ENV'
              value: production ? 'production' : 'test'
            }
            {
              name: 'DATA_MODE'
              value: 'database'
            }
            {
              name: 'PORT'
              value: '8080'
            }
          ]
          resources: {
            cpu: production ? 1 : 0.5
            memory: production ? '2Gi' : '1Gi'
          }
        }
      ]
      scale: {
        minReplicas: production ? 2 : 1
        maxReplicas: production ? 10 : 2
      }
    }
  }
}

resource worker 'Microsoft.App/containerApps@2023-05-01' = {
  name: workerName
  location: location
  properties: {
    managedEnvironmentId: containerEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
    }
    template: {
      containers: [
        {
          name: 'worker'
          image: workerImage
          env: [
            {
              name: 'NODE_ENV'
              value: production ? 'production' : 'test'
            }
          ]
          resources: {
            cpu: production ? 0.5 : 0.25
            memory: production ? '1Gi' : '0.5Gi'
          }
        }
      ]
      scale: {
        minReplicas: production ? 1 : 0
        maxReplicas: production ? 5 : 1
      }
    }
  }
}

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: postgresName
  location: location
  sku: {
    name: production ? 'Standard_D4ds_v5' : 'Standard_B2ms'
    tier: 'GeneralPurpose'
  }
  properties: {
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    version: '18'
    highAvailability: {
      mode: production ? 'ZoneRedundant' : 'Disabled'
    }
    backup: {
      backupRetentionDays: production ? 35 : 7
      geoRedundantBackup: production ? 'Enabled' : 'Disabled'
    }
    storage: {
      storageSizeGB: production ? 256 : 32
      autoGrow: 'Enabled'
    }
    authConfig: {
      activeDirectoryAuth: 'Enabled'
      passwordAuth: 'Enabled'
    }
    publicNetworkAccess: 'Disabled'
  }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  sku: {
    name: production ? 'Standard_ZRS' : 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    publicNetworkAccess: 'Disabled'
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
    encryption: {
      services: {
        blob: {
          enabled: true
        }
      }
      keySource: 'Microsoft.Storage'
    }
  }
}

resource quarantineContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  name: '${storage.name}/default/quarantine'
  properties: {
    publicAccess: 'None'
  }
}

resource cleanContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  name: '${storage.name}/default/clean'
  properties: {
    publicAccess: 'None'
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enablePurgeProtection: production
    sku: {
      family: 'A'
      name: 'standard'
    }
    publicNetworkAccess: 'Disabled'
  }
}

output containerEnvironmentId string = containerEnvironment.id
output webApiUrl string = 'https://${webApi.properties.configuration.ingress.fqdn}'
output postgresServerName string = postgres.name
output storageAccountName string = storage.name
output keyVaultName string = keyVault.name
