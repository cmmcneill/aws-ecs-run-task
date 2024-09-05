const core = require("@actions/core");
const {
        ECS
      } = require("@aws-sdk/client-ecs");

const ecs = new ECS();

function wait6Seconds() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve('resolved');
    }, 6000);
  });
}

  



const main = async () => {
  const cluster = core.getInput("cluster", { required: true });
  const taskDefinition = core.getInput("task-definition", { required: true });
  const subnets = core.getMultilineInput("subnets", { required: true });
  const securityGroups = core.getMultilineInput("security-groups", {
    required: true,
  });
  const targetContainerName = core.getInput('targetContainerName', {required : true});


  const assignPublicIp =
    core.getInput("assign-public-ip", { required: false }) || "ENABLED";
  const overrideContainer = core.getInput("override-container", {
    required: false,
  });
  const overrideContainerCommand = core.getMultilineInput(
    "override-container-command",
    {
      required: false,
    }
  );

  const taskParams = {
    taskDefinition,
    cluster,
    count: 1,
    launchType: "FARGATE",
    networkConfiguration: {
      awsvpcConfiguration: {
        subnets,
        assignPublicIp,
        securityGroups,
      },
    },
  };

  try {
    if (overrideContainerCommand.length > 0 && !overrideContainer) {
      throw new Error(
        "override-container is required when override-container-command is set"
      );
    }

    if (overrideContainer) {
      if (overrideContainerCommand) {
        taskParams.overrides = {
          containerOverrides: [
            {
              name: overrideContainer,
              command: overrideContainerCommand,
            },
          ],
        };
      } else {
        throw new Error(
          "override-container-command is required when override-container is set"
        );
      }
    }

    core.info("Running task...");
    let task = await ecs.runTask(taskParams);
    const taskArn = task.tasks[0].taskArn;
    core.setOutput("task-arn", taskArn);
    core.info("New Task ARN: " + taskArn);


    for(let z = 1; z < 300; z++) {
      task = await ecs.describeTasks({ cluster, tasks: [taskArn] });
  
      let status = task.tasks[0].lastStatus;
      core.info("Task Status is:" + status);
  
      if(status == "STOPPED") {
        core.info("Successfully achieved status of " + status);
        break;
      }
  
      await wait6Seconds();
    }


    core.info("Checking status of task");
    task = await ecs.describeTasks({ cluster, tasks: [taskArn] });

    let targetExitCode = -999;

    for(let x = 0; x < task.tasks[0].containers.length; x++) {
      const name =     task.tasks[0].containers[x].name;
      const exitCode = task.tasks[0].containers[x].exitCode;
      
      core.info("Container '" + name + " exited with code " + exitCode)
      
      if(name == targetContainerName) {
        targetExitCode = exitCode;
      }
    }

    if (targetExitCode === 0) {
      core.info("Exit code of important container was 0.  Success!");
      core.setOutput("status", "success");
    } else {
      core.info("Exit code of important container was " + exitCode);
      core.setFailed(task.tasks[0].stoppedReason);

      const taskHash = taskArn.split("/").pop();
      core.info(
        `Task failed.  See Amazon ECS console:`
      );
    }
  } catch (error) {
    core.setFailed(error.message);
  }
};

main();
