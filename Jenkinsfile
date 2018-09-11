pipeline {
  agent any
  tools {
    nodejs 'v8.12.0'
  }
  options {
    timestamps()
    skipDefaultCheckout true
  }
  triggers {
    pollSCM('H/5 * * * *')
  }

  stages {
    stage("Clean the workspace and checkout source") {
      steps {
        deleteDir()
        checkout scm
      }
    }

    stage ("install modules") {
      steps {
        sh "yarn"
      }
    }

    stage ("Module Security Check") {
      steps {
        sh "npm run security"
      }
    }

    stage ("Test Module") {
      steps {
        sh "npm test"
        // Publish test report
        junit healthScaleFactor: 100.0, testResults: '**/coverage/junit.xml'
        // Publish code coverage report
        cobertura(
          coberturaReportFile: '**/coverage/cobertura-coverage.xml',
          failUnstable: false,
          conditionalCoverageTargets: '70, 0, 0',
          lineCoverageTargets: '70, 0, 0',
          methodCoverageTargets: '70, 0, 0',
          maxNumberOfBuilds: 0,
          onlyStable: false,
          sourceEncoding: 'ASCII',
          zoomCoverageChart: false
        )
      }
    }
  }

  post {
    always {
      echo 'Setting the build version'
      script {
        def packageJson = readJSON file: "./package.json"
        currentBuild.description = "[version] ${packageJson.version}"
      }
      echo 'Cleaning the workspace'
      deleteDir()
    }
    success {
      echo "The force is strong with this one"
    }
    unstable {
      echo "Do or do not there is no try"
    }
    failure {
      echo "The dark side I sense in you."
    }
  }
}
