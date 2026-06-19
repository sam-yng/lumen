// React Doctor configuration (https://www.react.doctor/docs/configuration).
//
// The extend.ai PDF-viewer kit under apps/web/src/components/extend-ui/** is
// vendored third-party code (installed via the `@extend` shadcn registry and
// clobbered on re-install), so we do not hold it to our React Doctor rules.
// Plain default export — no `react-doctor/api` import — so the project's tsc
// pass never needs the react-doctor package resolvable.
export default {
  ignore: {
    files: [
      "apps/web/src/components/extend-ui/**",
      "**/components/extend-ui/**",
    ],
  },
};
