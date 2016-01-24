if [[ "$BRANCH" == "master" ]]; then
	DOKKU_HOST="ec2-52-2-122-50.compute-1.amazonaws.com"
else
	DOKKU_HOST="ec2-52-0-188-39.compute-1.amazonaws.com"
fi	

ssh -t dokku@$DOKKU_HOST cache:clear evmote-web
ssh -t dokku@$DOKKU_HOST cache:clear evmote-worker

curl -H "Authorization: apiToken 2dc3158e-573f-40b9-aeb4-92513383db00" -H "Content-Type: application/json" -d "{\"projectId\": \"56232f8f1895ca44741e705e\", \"branchName\": \"$BRANCH\"}" https://api.shippable.com/workflow/triggerBuild
curl -H "Authorization: apiToken 2dc3158e-573f-40b9-aeb4-92513383db00" -H "Content-Type: application/json" -d "{\"projectId\": \"56232f8f1895ca44741e7058\", \"branchName\": \"$BRANCH\"}" https://api.shippable.com/workflow/triggerBuild

