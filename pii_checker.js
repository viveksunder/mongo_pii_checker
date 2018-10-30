function pii_check(coll) {
    let confidence_above = function(fields, confidence) {
        let c = {};
        Object.keys(fields).forEach((k) => {
            Object.keys(fields[k]).forEach((m) => {
                percent = (fields[k][m]['matches'] / fields[k][m]['total']) * 100;
                if (percent > confidence) {
                    if (!c[k]) {
                        c[k] = {};
                    }
                    c[k][m] = {confidence: percent+'%', examples: fields[k][m]['examples']};
                }
            });
        });
        return c;
    };

    let _pii = function(cur) {
        let fields = {};
        let email_regexes = [/[a-zA-Z0-9_\-\.]+@[a-zA-Z0-9_\-]+\.[a-zA-Z]{2,6}/];
        let phone_regexes = [/[0-9]{10}/, /[0-9]{3}[-\.\*][0-9]{3}[-\.\*][0-9]{4}/, /\+[0-9]{7,18}/, /[0-9]{7,18}/];
        let twitter_regexes = [/@[a-zA-Z0-9_]{3,15}/];
        let ip_regexes = [/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/];

        let regex_match = function(matcher_name, field, regexes, v) {
            regexes.map((r) => {
                let matched = false;
                let match_val = v.match(r);
                if(match_val) {
                   matched = true; 
                }

                if(!fields[field]) {
                    fields[field] = {};
                }

                if(!fields[field][matcher_name]) {
                    fields[field][matcher_name] = {total: 0, matches: 0, examples: []};
                }
                
                if(fields[field][matcher_name]) {
                    if(matched) {
                        fields[field][matcher_name]['matches']++;
                        if(fields[field][matcher_name]['examples'].length < 5) {
                            fields[field][matcher_name]['examples'].push(match_val);
                        }
                        fields[field][matcher_name]['total']++;
                    } else {
                        fields[field][matcher_name]['total']++;
                    }
                } else {
                    if(matched) {
                        fields[field][matcher_name] = {matches: 1, total: 1, examples: []};
                    } else {
                        fields[field][matcher_name] = {matches: 0, total: 1, examples: []};
                    }
                }
                
            });
        };

        let _pii = function(key, obj) {
            if (obj && !obj.isClosed) {
                Object.keys(obj).forEach((k) => {
                    let v = obj[k];
                    let field = k;

                    if(key) {
                        field = [key, k].join('.');
                    }

                    if(isObject(v)) {
                       _pii(field, v);
                    } else if (Array.isArray(v)) {
                        field = field + '[]';
                        v.forEach((vo) => {
                            _pii(field, vo);
                        });
                        
                    } else if(v && isString(v)) {
                        regex_match('email', field, email_regexes, v);
                        regex_match('phone', field, phone_regexes, v);
                        regex_match('ip', field, ip_regexes, v);
                        regex_match('twitter', field, twitter_regexes, v);
                    }
                });
            } else if (obj && obj.isClosed) {
                while(obj.hasNext()) {
                    _pii(key, obj.next());
                }
            }
        };
        while(cur.hasNext()) {
            _pii('', cur.next());
        }
        return fields;
    };

    let count = coll.count();
    let objs = coll.aggregate([{$sample: {size: count*(5/100) }}]);
    let f = _pii(objs);
    f.confidence_above = confidence_above.bind(null, f);
    return f;
}
