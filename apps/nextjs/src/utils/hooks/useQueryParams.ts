import { useRouter } from "next/router";

export const useQueryParams = <U extends string, T extends Readonly<[U, ...U[]]>>(expectedParams: T): Record<U, string> | null => {
    const router = useRouter();
    const params = router.query;
    if(!Object.values(params).length) return null;

    const ret = {} as Record<U, string> ;
    for(const expectedParam of expectedParams) {
        const paramValue = params[expectedParam];
        if(typeof paramValue  !== "string") {
            console.warn(`${expectedParam} is not in query params`)
            return null;
        }

        ret[expectedParam] = paramValue;
    }

    return ret;
}