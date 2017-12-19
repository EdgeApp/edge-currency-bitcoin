node {
  try {
    stage ("Set Clean Environment") {
      deleteDir()    
    }

    stage ("checkout") {
      checkout scm
    }

    nodejs(nodeJSInstallationName: "LTS") {
      stage ("install modules") {
        sh "npm i"
      }

      stage ("Module Security Check") {
        sh "npm run security"
      }

      stage ("Test Module") {
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

    stage ("cleanup") {
      deleteDir()
      currentBuild.result = "SUCCESS"
    }
  }
  catch(err) {
    deleteDir()
    // Do not add a stage here.
    // When "stage" commands are run in a different order than the previous run
    // the history is hidden since the rendering plugin assumes that the system has changed and
    // that the old runs are irrelevant. As such adding a stage at this point will trigger a
    // "change of the system" each time a run fails.
    println "Something went wrong!"
    println err
    currentBuild.result = "FAILURE"
  }
  finally {
    println "Fin"
  }
}