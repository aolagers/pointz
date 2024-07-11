import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cf from "aws-cdk-lib/aws-cloudfront";
import * as cfo from "aws-cdk-lib/aws-cloudfront-origins";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";

interface PointzProps extends cdk.StackProps {
    deploy_s3: boolean;
    certArn: string;
    zoneID: string;
    zoneName: string;
    subdomain: string;
}

class PointzStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props: PointzProps) {
        super(scope, id, props);

        const bucket = new s3.Bucket(this, "bucket", {
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });

        const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, "hosted-zone", {
            hostedZoneId: props.zoneID,
            zoneName: props.zoneName,
        });

        const cert = acm.Certificate.fromCertificateArn(this, "cert", props.certArn);

        const S3_PREFIX = "/";

        const s3origin = new cfo.S3Origin(bucket, {
            originPath: S3_PREFIX,
        });

        const cloudfrontDistribution = new cf.Distribution(this, "cf", {
            certificate: cert,
            defaultBehavior: {
                origin: s3origin,
                viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            },
            additionalBehaviors: {
                "/index.html": {
                    origin: s3origin,
                    cachePolicy: cf.CachePolicy.CACHING_DISABLED,
                    viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                },
            },
            httpVersion: cf.HttpVersion.HTTP2_AND_3,
            domainNames: [props.subdomain + "." + props.zoneName],
            defaultRootObject: "index.html",
        });

        new route53.ARecord(this, "a-record", {
            zone: hostedZone,
            recordName: props.subdomain,
            target: route53.RecordTarget.fromAlias(new route53targets.CloudFrontTarget(cloudfrontDistribution)),
        });

        new route53.AaaaRecord(this, "aaaa-record", {
            zone: hostedZone,
            recordName: props.subdomain,
            target: route53.RecordTarget.fromAlias(new route53targets.CloudFrontTarget(cloudfrontDistribution)),
        });

        if (props.deploy_s3) {
            new s3deploy.BucketDeployment(this, "deployment", {
                sources: [s3deploy.Source.asset("../viewer/dist")],
                destinationBucket: bucket,
                destinationKeyPrefix: S3_PREFIX,
                prune: false,
            });
        }
    }
}

const app = new cdk.App();

const pointzStack = new PointzStack(app, "pointz", {
    env: {
        account: app.node.tryGetContext("accountID"),
        region: "eu-north-1",
    },

    certArn: app.node.tryGetContext("certArn"),
    zoneID: app.node.tryGetContext("zoneID"),
    zoneName: app.node.tryGetContext("zoneName"),
    subdomain: app.node.tryGetContext("subdomain"),

    deploy_s3: false,
});

cdk.Tags.of(pointzStack).add("pointz", "1");

app.synth();
