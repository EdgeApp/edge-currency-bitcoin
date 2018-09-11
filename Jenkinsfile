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
        publishHTML (target: [
          allowMissing: false,
          alwaysLinkToLastBuild: false,
          keepAll: true,
          reportDir: "coverage",
          reportFiles: "index.html",
          reportName: "Istanbul Report"
        ])
      }
    }
  }

  post {
    always {
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
