# Default PROJECT, if not given by another Makefile.
ifndef PROJECT
PROJECT=startpage.jcleal.me
endif

# ---

# The hosted zone id in Route53 (shared with jcleal.me — same zone).
HOSTED_ZONE_ID ?= $(shell aws ssm get-parameter --name /jcleal.me/hosted-zone/id --query 'Parameter.Value' --output text)

# The bucket to upload the website to (written by CF stack on first deploy).
UPLOAD_BUCKET ?= $(shell aws ssm get-parameter --name /$(REPO)/bucket --query 'Parameter.Value' --output text)

# The cert is shared with jcleal.me (wildcard *.jcleal.me).
CERT_ARN ?= $(shell aws ssm get-parameter --region us-east-1 --name /certs/jcleal.me/arn --query 'Parameter.Value' --output text)

# ---

# Services.
SERVICE_GROUP_1 = website

# Targets.
website: ## Deploys the 'website' stack.
website: ADDITIONAL_PARAMETER_OVERRIDES="AcmCertificateArn=$(CERT_ARN) "
website: ADDITIONAL_PARAMETER_OVERRIDES+="HostedZoneId=$(HOSTED_ZONE_ID) "
website: deploy-website

sync: ## Syncs website content to AWS S3.
sync:
	aws s3 sync --delete dist/ s3://$(UPLOAD_BUCKET)/

# ---

# Includes the common Makefile.
# NOTE: this recursively goes back and finds the `.git` directory and assumes
# this is the root of the project.
include $(shell while [[ ! -d .git ]]; do cd ..; done; pwd)/Makefile.common.mk
