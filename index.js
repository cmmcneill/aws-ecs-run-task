const core = require("@actions/core");
const AWS = require("aws-sdk");

const ecs = new AWS.ECS();

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
    let task = await ecs.runTask(taskParams).promise();
    const taskArn = task.tasks[0].taskArn;
    core.setOutput("task-arn", taskArn);
    core.info("New Task ARN: " + taskArn);


    for(let z = 1; z < 100; z++) {
      task = await ecs.describeTasks({ cluster, tasks: [taskArn] }).promise();
  
      let status = data.tasks[0].lastStatus;
      core.info("Task Status is:" + status);
  
      if(status == desiredStatus) {
        core.info("Successfully achieved status of " + status);
        break;
      }
  
      await wait6Seconds();
    }
    

    core.info("Checking status of task");
    task = await ecs.describeTasks({ cluster, tasks: [taskArn] }).promise();
    const exitCode = task.tasks[0].containers[0].exitCode;

    if (exitCode === 0) {
      core.info("Exit code of container was 0.  Success!");
      core.setOutput("status", "success");
    } else {
      core.info("Exit code of container was " + exitCode);
      core.setFailed(task.tasks[0].stoppedReason);

      const taskHash = taskArn.split("/").pop();
      core.info(
        `Task failed.  See Amazon ECS console: https://console.aws.amazon.com/ecs/home?region=${AWS.config.region}#/clusters/${cluster}/tasks/${taskHash}/details`
      );
    }
  } catch (error) {
    core.setFailed(error.message);
  }
};

main();
