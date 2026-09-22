export function ok(res, data = {}, metaOrStatus = undefined, status = 200) {
  let meta;
  let finalStatus = status;

  if (typeof metaOrStatus === 'number') {
    finalStatus = metaOrStatus;
  } else if (metaOrStatus && typeof metaOrStatus === 'object') {
    meta = metaOrStatus;
  }

  return res.status(finalStatus).json({
    success: true,
    data,
    ...(meta ? { meta } : {})
  });
}

export function created(res, data = {}, meta = undefined) {
  return ok(res, data, meta, 201);
}

export function fail(res, status = 500, error = 'Request failed', details = undefined) {
  return res.status(status).json({
    success: false,
    error,
    ...(details ? { details } : {})
  });
}

