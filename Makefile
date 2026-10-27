# Default PROJECT, if not given by another Makefile.
ifndef PROJECT
PROJECT=startpage.jcleal.me
endif

# ---

# The deploy container mounts the repo at /go/src/app, so Makefile.common.mk's REPO would resolve to 'app'. Pin it.
override REPO := startpage.jcleal.me

# The site's domain: startpage.jcleal.me in prod, startpage.<env>.jcleal.me elsewhere (e.g. startpage.dev.jcleal.me).
# It is also the bucket name (see cf/website/template.yml).
ifeq ($(ENVIRONMENT),prod)
PARENT_DOMAIN ?= jcleal.me
else
PARENT_DOMAIN ?= $(ENVIRONMENT).jcleal.me
endif
DOMAIN ?= startpage.$(PARENT_DOMAIN)

# The hosted zone id in Route53 (the parent domain's zone, shared with jcleal.me).
HOSTED_ZONE_ID ?= $(shell aws ssm get-parameter --name /$(PARENT_DOMAIN)/hosted-zone/id --query 'Parameter.Value' --output text)

# The bucket to upload the website to.
UPLOAD_BUCKET ?= $(DOMAIN)

# The cert for the parent domain (covers *.<parent>). Dev certs live in the dev AWS account, prod certs in prod.
CERT_ARN ?= $(shell aws ssm get-parameter --region us-east-1 --name /certs/$(PARENT_DOMAIN)/arn --query 'Parameter.Value' --output text)

pull-config: # Pulls the config pulled from AWS when deploying.
pull-config:
	@echo $(HOSTED_ZONE_ID)
	@echo $(UPLOAD_BUCKET)
	@echo $(CERT_ARN)

# ---

# Services.
SERVICE_GROUP_1 = website

# Targets.
website: ## Deploys the 'website' stack.
website: ADDITIONAL_PARAMETER_OVERRIDES="AcmCertificateArn=$(CERT_ARN) "
website: ADDITIONAL_PARAMETER_OVERRIDES+="HostedZoneId=$(HOSTED_ZONE_ID) "
website: ADDITIONAL_PARAMETER_OVERRIDES+="Domain=$(DOMAIN) "
website: deploy-website

sync: ## Syncs the downloaded website artifact (dist/) to AWS S3; called by the 50-upload pipeline.
sync:
	aws s3 sync --delete dist/ s3://$(UPLOAD_BUCKET)/
ifeq ($(ENVIRONMENT),prod)
	@# The live site sits behind CloudFront; drop its cached copies so visitors get the new content.
	id="$$(aws cloudfront list-distributions --query "DistributionList.Items[?Aliases.Items[?@=='$(DOMAIN)']].Id | [0]" --output text)"; \
	test -n "$$id" -a "$$id" != None || { echo "no CloudFront distribution has the alias $(DOMAIN)"; exit 1; }; \
	aws cloudfront create-invalidation --distribution-id "$$id" --paths '/*'
endif

# ---

# Includes the common Makefile.
# NOTE: this recursively goes back and finds the `.git` directory and assumes
# this is the root of the project.
include $(shell while [[ ! -d .git ]]; do cd ..; done; pwd)/Makefile.common.mk
