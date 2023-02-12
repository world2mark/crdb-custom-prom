# CockroachDB custom Prometheus endpoints

```
oc project mz-a
oc new-build --binary --image-stream nodejs --name crdb-custom-prom
<delete/nove node_modules>
oc start-build crdb-custom-prom --from-dir=.
oc new-app crdb-custom-prom
```

App listens to port 3012, so create service accordingly with targetPort: 3012

Create the route
```
oc create route edge --service=crdb-custom-prom crdb-custom-prom --hostname crdb-custom-prom.auracoda.com -n mz-a
```
