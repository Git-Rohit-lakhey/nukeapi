// Braintree ships its own types in newer versions, but to keep the build
// green regardless of the installed minor we treat the module as untyped and
// rely on local casts at the call sites (the connector only uses
// BraintreeGateway + customer.search/delete).
declare module "braintree";
