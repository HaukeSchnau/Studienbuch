export {
  environmentConfig,
  revisionConfig,
  serverConfig,
  serviceInstanceIdConfig,
  serviceVersionConfig,
  type ServerConfig,
} from "./otlp/config.ts";
export {
  developmentLayer,
  flushOtlp,
  otlpProtobufLayer,
  productionJsonLayer,
  serverObservabilityLayer,
  type OtlpServerLayerOptions,
} from "./otlp/layers.ts";
